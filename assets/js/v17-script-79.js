window.PlatdoReleaseData.unshift({
  id:'v17-city-audio',version:17,date:'2026-11-02',major:false,
  title:'City sound on iPhone',
  thumbnail:'assets/images/c8916acf043565f06819.jpg',thumbnailAlt:'Inside Platdo City',
  summary:'City can finish loading while Safari waits for a tap to play audio.',
  sections:[
    {title:'Entering City',items:[
      'World preparation, sound-bank preparation and the first rendered frame now have separate progress labels and timestamps.',
      'Entering City activates playback from your tap. If the browser interrupts playback, City can offer a Tap to enable sound button.',
      'Recordings decode in a bounded queue. A stuck recording can no longer hold the startup screen indefinitely. Unavailable effects can be retried individually without reloading the game.',
      'Settings → Audio → Sound diagnostics shows the playback state, available and failed recordings, retry attempts and a timestamped history. The existing mute and mixer controls still apply.'
    ]}
  ]
});
