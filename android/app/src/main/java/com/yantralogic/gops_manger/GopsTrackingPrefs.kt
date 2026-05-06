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

  fun save(ctx: Context, config: ReadableMap) {
    val sp = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    if (config.hasKey("sessionId")) sp.putString(KEY_SESSION, config.getString("sessionId"))
    if (config.hasKey("apiBaseUrl")) sp.putString(KEY_API, config.getString("apiBaseUrl"))
    if (config.hasKey("token")) sp.putString(KEY_TOKEN, config.getString("token"))
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
    sp.apply()
  }

  fun clear(ctx: Context) {
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
  }

  fun sessionId(ctx: Context): String? =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SESSION, null)
}
