package com.yantralogic.gops_manger

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

class GopsTrackingBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (GopsTrackingPrefs.sessionId(context) == null) return
    val i =
      Intent(context, GopsTrackingService::class.java).apply {
        action = GopsTrackingService.ACTION_START
      }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ContextCompat.startForegroundService(context, i)
      } else {
        context.startService(i)
      }
    } catch (_: Exception) {
      /* ignore */
    }
  }
}
