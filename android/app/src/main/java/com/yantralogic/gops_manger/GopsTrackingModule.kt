package com.yantralogic.gops_manger

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class GopsTrackingModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "GopsTracking"

  @ReactMethod
  fun startNativeTracking(config: ReadableMap, promise: Promise) {
    try {
      val sessionId = config.getString("sessionId") ?: ""
      if (sessionId.isEmpty()) {
        promise.reject("E_CONFIG", "sessionId required")
        return
      }
      GopsTrackingPrefs.save(reactContext, config)
      val intent = Intent(reactContext, GopsTrackingService::class.java).apply {
        action = GopsTrackingService.ACTION_START
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent)
      } else {
        reactContext.startService(intent)
      }
      promise.resolve(buildHealthMap(reactContext))
    } catch (e: Exception) {
      promise.reject("E_NATIVE_TRACKING", e.message, e)
    }
  }

  @ReactMethod
  fun stopNativeTracking(promise: Promise) {
    try {
      GopsTrackingPrefs.clear(reactContext)
      reactContext.stopService(Intent(reactContext, GopsTrackingService::class.java))
      promise.resolve(buildHealthMap(reactContext))
    } catch (e: Exception) {
      promise.reject("E_NATIVE_TRACKING", e.message, e)
    }
  }

  @ReactMethod
  fun syncNativeTrackingState(promise: Promise) {
    try {
      if (GopsTrackingPrefs.sessionId(reactContext) != null) {
        val intent = Intent(reactContext, GopsTrackingService::class.java).apply {
          action = GopsTrackingService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          reactContext.startForegroundService(intent)
        } else {
          reactContext.startService(intent)
        }
      }
      promise.resolve(buildHealthMap(reactContext))
    } catch (e: Exception) {
      promise.reject("E_NATIVE_TRACKING", e.message, e)
    }
  }

  @ReactMethod
  fun getTrackingHealth(promise: Promise) {
    try {
      promise.resolve(buildHealthMap(reactContext))
    } catch (e: Exception) {
      promise.reject("E_NATIVE_TRACKING", e.message, e)
    }
  }

  @ReactMethod
  fun openBatteryOptimizationSettings(promise: Promise) {
    try {
      val ctx = reactContext.applicationContext
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      val pkg = ctx.packageName
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        if (!pm.isIgnoringBatteryOptimizations(pkg)) {
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:$pkg")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          if (intent.resolveActivity(ctx.packageManager) != null) {
            ctx.startActivity(intent)
            promise.resolve(true)
            return
          }
        }
      }
      val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      ctx.startActivity(fallback)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_BATTERY", e.message, e)
    }
  }

  @ReactMethod
  fun startComplianceAlarm(reason: String?, promise: Promise) {
    try {
      ComplianceAlarmActivity.show(reactContext.applicationContext, reason ?: "compliance")
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_ALARM", e.message, e)
    }
  }

  @ReactMethod
  fun stopComplianceAlarm(promise: Promise) {
    try {
      reactContext.sendBroadcast(Intent(ComplianceAlarmActivity.ACTION_STOP))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_ALARM", e.message, e)
    }
  }

  companion object {
    fun buildHealthMap(ctx: Context): WritableMap {
      val map = Arguments.createMap()
      val sessionActive = GopsTrackingPrefs.sessionId(ctx) != null
      map.putBoolean("trackingActive", sessionActive)
      map.putBoolean("nativeServiceRunning", GopsTrackingService.isRunning)
      map.putBoolean(
        "foregroundLocationGranted",
        ctx.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) ==
          android.content.pm.PackageManager.PERMISSION_GRANTED,
      )
      val bgGranted =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ctx.checkSelfPermission(android.Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
          true
        }
      map.putBoolean("backgroundLocationGranted", bgGranted)
      map.putBoolean(
        "notificationGranted",
        NotificationManagerCompat.from(ctx).areNotificationsEnabled(),
      )
      val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as android.location.LocationManager
      map.putBoolean(
        "gpsEnabled",
        lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) ||
          lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER),
      )
      val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
      val network = cm.activeNetwork
      val caps = if (network != null) cm.getNetworkCapabilities(network) else null
      map.putBoolean(
        "networkConnected",
        caps != null && caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET),
      )
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      val ignoring =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          pm.isIgnoringBatteryOptimizations(ctx.packageName)
        } else {
          true
        }
      map.putBoolean("batteryOptimizationIgnored", ignoring)
      map.putNull("lastPingAt")
      map.putString("lastComplianceReason", GopsTrackingService.lastComplianceReason)
      map.putInt("queuedPingCount", 0)
      map.putInt("queuedComplianceCount", 0)
      return map
    }
  }
}
