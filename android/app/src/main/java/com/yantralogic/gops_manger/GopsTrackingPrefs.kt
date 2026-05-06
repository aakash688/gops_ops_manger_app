package com.yantralogic.gops_manger

import android.content.Context
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

object GopsTrackingPrefs {
  private const val PREFS = "gops_tracking_native"
  private const val KEY_SESSION = "sessionId"
  private const val KEY_API = "apiBaseUrl"
  private const val KEY_TOKEN = "token"
  private const val KEY_INTERVAL = "pingIntervalSec"
  private const val KEY_EMPLOYEE = "employeeId"
  private const val KEY_LAST_PING = "lastPingAtMs"

  fun save(ctx: Context, config: ReadableMap) {
    val sp = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    putAll(sp, config)
    sp.apply()
  }

  fun merge(ctx: Context, config: ReadableMap) {
    val sp = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    putAll(sp, config)
    sp.apply()
  }

  private fun putAll(
    sp: android.content.SharedPreferences.Editor,
    config: ReadableMap,
  ) {
    if (config.hasKey("sessionId") && !config.isNull("sessionId")) {
      sp.putString(KEY_SESSION, config.getString("sessionId"))
    }
    if (config.hasKey("apiBaseUrl") && !config.isNull("apiBaseUrl")) {
      sp.putString(KEY_API, config.getString("apiBaseUrl"))
    }
    if (config.hasKey("token") && !config.isNull("token")) {
      sp.putString(KEY_TOKEN, config.getString("token"))
    }
    if (config.hasKey("pingIntervalSec") && !config.isNull("pingIntervalSec")) {
      val v =
        when (config.getType("pingIntervalSec")) {
          ReadableType.Number -> config.getDouble("pingIntervalSec").toInt()
          ReadableType.String ->
            config.getString("pingIntervalSec")?.toDoubleOrNull()?.toInt() ?: 90
          else -> 90
        }
      sp.putInt(KEY_INTERVAL, v)
    }
    if (config.hasKey("employeeId") && !config.isNull("employeeId")) {
      sp.putString(KEY_EMPLOYEE, config.getString("employeeId"))
    }
  }

  fun clear(ctx: Context) {
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
  }

  fun sessionId(ctx: Context): String? =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SESSION, null)

  fun apiBaseUrl(ctx: Context): String =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_API, "") ?: ""

  fun token(ctx: Context): String? =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TOKEN, null)

  fun pingIntervalSec(ctx: Context): Int =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_INTERVAL, 90)

  fun markPingSuccess(ctx: Context) {
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putLong(KEY_LAST_PING, System.currentTimeMillis())
      .apply()
  }

  fun lastPingAtIso(ctx: Context): String? {
    val t =
      ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_LAST_PING, 0L)
    if (t <= 0L) return null
    return java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
      timeZone = java.util.TimeZone.getTimeZone("UTC")
    }.format(java.util.Date(t))
  }
}
