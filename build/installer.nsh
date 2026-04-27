!macro customInstall
  DetailPrint "Registering Windows screensaver"
  ${if} ${RunningX64}
    ${DisableX64FSRedirection}
  ${endif}

  ; The Screen Saver control panel launches the .scr directly from System32.
  ; Electron requires several companion files next to the executable,
  ; so deploy the runtime payload beside the .scr.
  CreateDirectory "$WINDIR\System32\resources"
  CreateDirectory "$WINDIR\System32\locales"

  CopyFiles /SILENT "$INSTDIR\chrome_100_percent.pak" "$WINDIR\System32\chrome_100_percent.pak"
  CopyFiles /SILENT "$INSTDIR\chrome_200_percent.pak" "$WINDIR\System32\chrome_200_percent.pak"
  CopyFiles /SILENT "$INSTDIR\ffmpeg.dll" "$WINDIR\System32\ffmpeg.dll"
  CopyFiles /SILENT "$INSTDIR\icudtl.dat" "$WINDIR\System32\icudtl.dat"
  CopyFiles /SILENT "$INSTDIR\libEGL.dll" "$WINDIR\System32\libEGL.dll"
  CopyFiles /SILENT "$INSTDIR\libGLESv2.dll" "$WINDIR\System32\libGLESv2.dll"
  CopyFiles /SILENT "$INSTDIR\resources.pak" "$WINDIR\System32\resources.pak"
  CopyFiles /SILENT "$INSTDIR\snapshot_blob.bin" "$WINDIR\System32\snapshot_blob.bin"
  CopyFiles /SILENT "$INSTDIR\v8_context_snapshot.bin" "$WINDIR\System32\v8_context_snapshot.bin"
  CopyFiles /SILENT "$INSTDIR\vk_swiftshader.dll" "$WINDIR\System32\vk_swiftshader.dll"
  CopyFiles /SILENT "$INSTDIR\vk_swiftshader_icd.json" "$WINDIR\System32\vk_swiftshader_icd.json"
  CopyFiles /SILENT "$INSTDIR\resources\*.*" "$WINDIR\System32\resources"
  CopyFiles /SILENT "$INSTDIR\locales\*.*" "$WINDIR\System32\locales"

  CopyFiles /SILENT "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$WINDIR\System32\EVE Ships Screensaver.scr"
  ${if} ${RunningX64}
    ${EnableX64FSRedirection}
  ${endif}
!macroend

!macro customUnInstall
  DetailPrint "Removing Windows screensaver registration"
  ${if} ${RunningX64}
    ${DisableX64FSRedirection}
  ${endif}

  Delete "$WINDIR\System32\chrome_100_percent.pak"
  Delete "$WINDIR\System32\chrome_200_percent.pak"
  Delete "$WINDIR\System32\ffmpeg.dll"
  Delete "$WINDIR\System32\icudtl.dat"
  Delete "$WINDIR\System32\libEGL.dll"
  Delete "$WINDIR\System32\libGLESv2.dll"
  Delete "$WINDIR\System32\resources.pak"
  Delete "$WINDIR\System32\snapshot_blob.bin"
  Delete "$WINDIR\System32\v8_context_snapshot.bin"
  Delete "$WINDIR\System32\vk_swiftshader.dll"
  Delete "$WINDIR\System32\vk_swiftshader_icd.json"
  Delete "$WINDIR\System32\resources\*.*"
  Delete "$WINDIR\System32\locales\*.*"
  RMDir "$WINDIR\System32\resources"
  RMDir "$WINDIR\System32\locales"

  Delete "$WINDIR\System32\EVE Ships Screensaver.scr"
  ${if} ${RunningX64}
    ${EnableX64FSRedirection}
  ${endif}
!macroend
