package com.yantralogic.gops_manger

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.ConnectivityManager
import android.net.Uri
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Bundle
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

/**
 * Foreground service: location fixes + REST pings without the React/Expo process.
 * Survives when the user swipes the app away from recents (OEM permitting).
 */
class GopsTrackingService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private val httpExecutor = Executors.newSingleThreadExecutor()
  private val httpClient =
    OkHttpClient.Builder()
      .connectTimeout(30, TimeUnit.SECONDS)
      .readTimeout(45, TimeUnit.SECONDS)
      .writeTimeout(45, TimeUnit.SECONDS)
      .build()

  private var gpsRegistered = false
  private var networkRegistered = false
  private var lastPostElapsed = 0L
  private var breachNotifShown = false
  /** Loops the same OGG as the in-app siren while breached and the UI is not in foreground. */
  private var complianceAlarmPlayer: MediaPlayer? = null

  private val locationListener: LocationListener =
    object : LocationListener {
      override fun onLocationChanged(loc: Location) {
        maybePostPing(loc)
      }

      @Deprecated("Deprecated in Java")
      override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

      override fun onProviderEnabled(provider: String) {}

      override fun onProviderDisabled(provider: String) {}
    }

  private val complianceRunnable =
    object : Runnable {
      override fun run() {
        if (!isRunning) return
        evaluateCompliance()
        handler.postDelayed(this, COMPLIANCE_POLL_MS)
      }
    }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      shutdown()
      stopSelf()
      return START_NOT_STICKY
    }
    if (GopsTrackingPrefs.sessionId(this) == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    startForeground(NOTIF_TRACKING_ID, buildTrackingNotification())
    isRunning = true
    registerLocationUpdates()
    handler.removeCallbacks(complianceRunnable)
    handler.post(complianceRunnable)
    return START_STICKY
  }

  override fun onDestroy() {
    shutdown()
    super.onDestroy()
  }

  private fun shutdown() {
    isRunning = false
    handler.removeCallbacks(complianceRunnable)
    unregisterLocationUpdates()
    clearBreachNotification()
    stopComplianceAlarmLoop()
    breachNotifShown = false
    lastComplianceReason = null
    lastBreachType = null
    httpExecutor.shutdown()
  }

  private fun registerLocationUpdates() {
    unregisterLocationUpdates()
    if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return
    }
    val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val minMs =
      pingIntervalMs().coerceIn(30_000L, 600_000L)
    try {
      if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
        lm.requestLocationUpdates(
          LocationManager.GPS_PROVIDER,
          minMs,
          0f,
          locationListener,
          Looper.getMainLooper(),
        )
        gpsRegistered = true
      }
      if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
        lm.requestLocationUpdates(
          LocationManager.NETWORK_PROVIDER,
          minMs,
          0f,
          locationListener,
          Looper.getMainLooper(),
        )
        networkRegistered = true
      }
    } catch (_: SecurityException) {
      /* ignore */
    } catch (_: Exception) {
      /* ignore */
    }
  }

  private fun unregisterLocationUpdates() {
    if (!gpsRegistered && !networkRegistered) return
    try {
      val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      lm.removeUpdates(locationListener)
    } catch (_: Exception) {
      /* ignore */
    }
    gpsRegistered = false
    networkRegistered = false
  }

  private fun pingIntervalMs(): Long {
    val sec = GopsTrackingPrefs.pingIntervalSec(this).coerceIn(30, 600)
    return sec * 1000L
  }

  private fun maybePostPing(loc: Location) {
    val intervalMs = pingIntervalMs().coerceIn(30_000L, 600_000L)
    val now = SystemClock.elapsedRealtime()
    if (now - lastPostElapsed < intervalMs) return
    lastPostElapsed = now
    try {
      httpExecutor.execute { postPingWorker(loc) }
    } catch (_: Exception) {
      /* executor shut down */
    }
  }

  private fun postPingWorker(loc: Location) {
    val base = GopsTrackingPrefs.apiBaseUrl(this).trim().trimEnd('/')
    val session = GopsTrackingPrefs.sessionId(this) ?: return
    if (base.isEmpty()) return

    val token = GopsTrackingPrefs.token(this)
    val iso = utcIso(loc.time)

    val ping =
      JSONObject().apply {
        put("latitude", loc.latitude)
        put("longitude", loc.longitude)
        put("timestamp", iso)
        if (loc.accuracy > 0f) put("accuracyMeters", loc.accuracy.toDouble())
        if (!loc.speed.isNaN() && loc.speed >= 0f) put("speedMps", loc.speed.toDouble())
        batteryPercent()?.let { put("batteryLevel", it) }
        put("networkType", networkTypeLabel())
        put("status", "LIVE")
      }

    val body =
      JSONObject().apply {
        put("sessionId", session)
        put("pings", JSONArray().put(ping))
      }

    val url = "$base/apps/live-tracking/pings"
    val media = "application/json; charset=utf-8".toMediaType()
    val reqBuilder =
      Request.Builder()
        .url(url)
        .post(body.toString().toRequestBody(media))
        .header("Accept", "application/json")
    if (!token.isNullOrBlank()) {
      reqBuilder.header("Authorization", "Bearer $token")
    }
    try {
      httpClient.newCall(reqBuilder.build()).execute().use { res ->
        if (res.isSuccessful) {
          GopsTrackingPrefs.markPingSuccess(this)
        }
      }
    } catch (_: Exception) {
      /* queue retry could be added later */
    }
  }

  private fun utcIso(timeMs: Long): String {
    val fmt =
      SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
      }
    return fmt.format(Date(timeMs))
  }

  private fun batteryPercent(): Int? {
    return try {
      val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
      val p = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
      if (p in 0..100) p else null
    } catch (_: Exception) {
      null
    }
  }

  private fun networkTypeLabel(): String {
    return try {
      val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      val n = cm.activeNetwork ?: return "OFFLINE"
      val caps = cm.getNetworkCapabilities(n) ?: return "UNKNOWN"
      when {
        !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) -> "OFFLINE"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
        else -> "UNKNOWN"
      }
    } catch (_: Exception) {
      "UNKNOWN"
    }
  }

  private fun isAppForeground(): Boolean {
    val am = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
    val processes = am.runningAppProcesses ?: return false
    for (p in processes) {
      if (p.processName == packageName) {
        return p.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
      }
    }
    return false
  }

  private fun evaluateCompliance() {
    val fg = isAppForeground()
    if (fg) {
      clearBreachNotification()
      stopComplianceAlarmLoop()
    }

    val fine =
      ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

    val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val locOn =
      lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
        lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

    val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = cm.activeNetwork
    val caps = if (network != null) cm.getNetworkCapabilities(network) else null
    val netOk =
      caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)

    val breach =
      when {
        !fine -> BREACH_PERM
        !locOn -> BREACH_GPS
        !netOk -> BREACH_NET
        else -> null
      }

    lastComplianceReason = breach
    if (breach != lastBreachType) {
      lastBreachType = breach
      breachNotifShown = false
      if (breach == null) {
        clearBreachNotification()
        stopComplianceAlarmLoop()
      }
    }

    if (!fg && breach != null) {
      if (!breachNotifShown) {
        postBreachNotification(breach)
        breachNotifShown = true
      }
      startComplianceAlarmLoop()
    } else if (breach == null) {
      stopComplianceAlarmLoop()
    }
    if (fg && breach != null) {
      breachNotifShown = false
    }

    registerLocationUpdates()
  }

  private fun startComplianceAlarmLoop() {
    if (complianceAlarmPlayer != null) return
    try {
      val player =
        MediaPlayer.create(this, R.raw.gops_alarm_clock) ?: return
      player.setAudioAttributes(complianceAlertAudioAttributes())
      player.isLooping = true
      player.setVolume(1f, 1f)
      player.setOnErrorListener { mp, _, _ ->
        try {
          mp.stop()
          mp.release()
        } catch (_: Exception) {
        }
        complianceAlarmPlayer = null
        true
      }
      player.start()
      complianceAlarmPlayer = player
    } catch (_: Exception) {
      stopComplianceAlarmLoop()
    }
  }

  private fun stopComplianceAlarmLoop() {
    val p = complianceAlarmPlayer ?: return
    complianceAlarmPlayer = null
    try {
      if (p.isPlaying) p.stop()
    } catch (_: Exception) {
    }
    try {
      p.release()
    } catch (_: Exception) {
    }
  }

  /** Same asset as JS `sirenCache` / `LiveTrackingComplianceOverlay` (alarm_clock.ogg). */
  private fun complianceAlertSoundUri(): Uri =
    Uri.parse("android.resource://$packageName/${R.raw.gops_alarm_clock}")

  private fun complianceAlertAudioAttributes(): AudioAttributes =
    AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

  private fun createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(
        CH_TRACKING,
        getString(R.string.gops_notif_channel_tracking),
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        setShowBadge(false)
      },
    )

    val soundUri = complianceAlertSoundUri()
    val attrs = complianceAlertAudioAttributes()

    nm.createNotificationChannel(
      NotificationChannel(
        CH_ALERT,
        getString(R.string.gops_notif_channel_alert),
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = getString(R.string.gops_notif_channel_alert_desc)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 400, 200, 400)
        setSound(soundUri, attrs)
        setBypassDnd(true)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      },
    )
  }

  private fun buildTrackingNotification(): Notification {
    val launch =
      packageManager.getLaunchIntentForPackage(packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      }
    val pi =
      PendingIntent.getActivity(
        this,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or pendingImmutable(),
      )
    return NotificationCompat.Builder(this, CH_TRACKING)
      .setContentTitle(getString(R.string.gops_notif_tracking_title))
      .setContentText(getString(R.string.gops_notif_tracking_body))
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setContentIntent(pi)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  private fun postBreachNotification(breach: String) {
    val launch =
      packageManager.getLaunchIntentForPackage(packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
    val tapPi =
      PendingIntent.getActivity(
        this,
        3,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or pendingImmutable(),
      )

    val (title, body) = breachCopy(breach)
    val b =
      NotificationCompat.Builder(this, CH_ALERT)
        .setContentTitle(title)
        .setContentText(body)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setAutoCancel(false)
        .setOngoing(true)
        .setContentIntent(tapPi)
        // Ongoing loop uses MediaPlayer (same raw OGG); keep shade entry silent so we do not stack with channel tone.
        .setSilent(true)
        .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
        .setOnlyAlertOnce(false)

    val nm = ContextCompat.getSystemService(this, NotificationManager::class.java)
    nm?.notify(NOTIF_BREACH_ID, b.build())
  }

  private fun breachCopy(breach: String): Pair<String, String> {
    return when (breach) {
      BREACH_PERM ->
        getString(R.string.gops_breach_perm_title) to getString(R.string.gops_breach_perm_body)
      BREACH_GPS ->
        getString(R.string.gops_breach_gps_title) to getString(R.string.gops_breach_gps_body)
      else ->
        getString(R.string.gops_breach_net_title) to getString(R.string.gops_breach_net_body)
    }
  }

  private fun clearBreachNotification() {
    val nm = ContextCompat.getSystemService(this, NotificationManager::class.java)
    nm?.cancel(NOTIF_BREACH_ID)
  }

  private fun pendingImmutable(): Int {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_IMMUTABLE
    } else {
      0
    }
  }

  companion object {
    const val ACTION_START = "com.yantralogic.gops_manger.TRACKING_START"
    const val ACTION_STOP = "com.yantralogic.gops_manger.TRACKING_STOP"

    private const val CH_TRACKING = "gops_tracking"
    // Bumped when alert sound changes so the system recreates the channel with the new tone.
    private const val CH_ALERT = "gops_compliance_alert_app_alarm"
    private const val NOTIF_TRACKING_ID = 7101
    private const val NOTIF_BREACH_ID = 7102
    private const val COMPLIANCE_POLL_MS = 6_000L

    private const val BREACH_PERM = "perm"
    private const val BREACH_GPS = "gps"
    private const val BREACH_NET = "network"

    @Volatile
    var isRunning: Boolean = false

    @Volatile
    var lastComplianceReason: String? = null

    @Volatile
    private var lastBreachType: String? = null
  }
}
