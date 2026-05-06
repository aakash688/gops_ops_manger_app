package com.yantralogic.gops_manger

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class ComplianceAlarmActivity : AppCompatActivity() {

  private var player: MediaPlayer? = null
  private var vibTimer: Runnable? = null
  private val vibHandler = android.os.Handler(android.os.Looper.getMainLooper())
  private val stopReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        finish()
      }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    setContentView(R.layout.activity_compliance_alarm)

    ContextCompat.registerReceiver(
      this,
      stopReceiver,
      IntentFilter(ACTION_STOP),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )

    startAlarmEffects()
  }

  override fun onDestroy() {
    stopAlarmEffects()
    try {
      unregisterReceiver(stopReceiver)
    } catch (_: Exception) {
      /* already unregistered */
    }
    super.onDestroy()
  }

  private fun startAlarmEffects() {
    try {
      val uri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      player =
        MediaPlayer().apply {
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build(),
          )
          setDataSource(this@ComplianceAlarmActivity, uri)
          isLooping = true
          prepare()
          start()
        }
    } catch (_: Exception) {
      player = null
    }

    val vibrator =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
        vm.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(VIBRATOR_SERVICE) as Vibrator
      }

    val tick: Runnable =
      object : Runnable {
        override fun run() {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE))
          } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(500)
          }
          vibHandler.postDelayed(this, 700)
        }
      }
    vibTimer = tick
    vibHandler.post(tick)
  }

  private fun stopAlarmEffects() {
    vibTimer?.let { vibHandler.removeCallbacks(it) }
    vibTimer = null
    try {
      player?.stop()
      player?.release()
    } catch (_: Exception) {
      /* ignore */
    }
    player = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val vm = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
      vm.defaultVibrator.cancel()
    } else {
      @Suppress("DEPRECATION")
      (getSystemService(VIBRATOR_SERVICE) as? Vibrator)?.cancel()
    }
  }

  companion object {
    const val EXTRA_REASON = "reason"
    const val ACTION_STOP = "com.yantralogic.gops_manger.STOP_COMPLIANCE_ALARM"

    fun show(ctx: Context, reason: String) {
      val i =
        Intent(ctx, ComplianceAlarmActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
          putExtra(EXTRA_REASON, reason)
        }
      ctx.startActivity(i)
    }
  }
}
