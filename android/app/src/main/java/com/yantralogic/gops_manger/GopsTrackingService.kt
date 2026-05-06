package com.yantralogic.gops_manger

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class GopsTrackingService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var passiveRegistered = false
  private val locationListener =
    android.location.LocationListener { /* passive — legitimizes location FGS */ }

  private val pollRunnable =
    object : Runnable {
      override fun run() {
        if (!isRunning) return
        evaluateCompliance()
        handler.postDelayed(this, POLL_MS)
      }
    }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        if (GopsTrackingPrefs.sessionId(this) == null) {
          stopSelf()
          return START_NOT_STICKY
        }
        startForeground(NOTIF_TRACKING_ID, buildTrackingNotification())
        isRunning = true
        registerPassiveLocationIfPossible()
        handler.removeCallbacks(pollRunnable)
        handler.post(pollRunnable)
      }
      ACTION_STOP -> {
        shutdown()
        stopSelf()
        return START_NOT_STICKY
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    shutdown()
    super.onDestroy()
  }

  private fun shutdown() {
    isRunning = false
    handler.removeCallbacks(pollRunnable)
    unregisterPassiveLocation()
    clearBreachNotification()
    sendBroadcast(Intent(ComplianceAlarmActivity.ACTION_STOP))
    lastBreachType = null
    lastComplianceReason = null
  }

  private fun registerPassiveLocationIfPossible() {
    if (passiveRegistered) return
    if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return
    }
    try {
      val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      lm.requestLocationUpdates(
        LocationManager.PASSIVE_PROVIDER,
        PASSIVE_MIN_MS,
        0f,
        locationListener,
        Looper.getMainLooper(),
      )
      passiveRegistered = true
    } catch (_: Exception) {
      /* ignore */
    }
  }

  private fun unregisterPassiveLocation() {
    if (!passiveRegistered) return
    try {
      val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      lm.removeUpdates(locationListener)
    } catch (_: Exception) {
      /* ignore */
    }
    passiveRegistered = false
  }

  private fun isAppForeground(): Boolean {
    val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val processes = am.runningAppProcesses ?: return false
    for (p in processes) {
      if (p.processName == packageName) {
        return p.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
      }
    }
    return false
  }

  private fun evaluateCompliance() {
    val fg = isAppForeground()
    if (fg) {
      clearBreachNotification()
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

    if (breach != lastBreachType) {
      lastBreachType = breach
      if (breach == null) {
        lastComplianceReason = null
        clearBreachNotification()
        sendBroadcast(Intent(ComplianceAlarmActivity.ACTION_STOP))
      } else {
        lastComplianceReason = breach
        if (!fg) {
          postBreachNotification(breach)
        }
      }
    }
  }

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
    nm.createNotificationChannel(
      NotificationChannel(
        CH_ALERT,
        getString(R.string.gops_notif_channel_alert),
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = getString(R.string.gops_notif_channel_alert_desc)
        enableVibration(true)
        setBypassDnd(true)
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
    val launchAlarm =
      Intent(this, ComplianceAlarmActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        putExtra(ComplianceAlarmActivity.EXTRA_REASON, breach)
      }
    val fullScreenPi =
      PendingIntent.getActivity(
        this,
        2,
        launchAlarm,
        PendingIntent.FLAG_UPDATE_CURRENT or pendingImmutable(),
      )
    val tapPi =
      PendingIntent.getActivity(
        this,
        3,
        launchAlarm,
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
        .setFullScreenIntent(fullScreenPi, true)
        .setDefaults(NotificationCompat.DEFAULT_ALL)

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
    private const val CH_ALERT = "gops_compliance_alert"
    private const val NOTIF_TRACKING_ID = 7101
    private const val NOTIF_BREACH_ID = 7102
    private const val POLL_MS = 8_000L
    private const val PASSIVE_MIN_MS = 60_000L

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
