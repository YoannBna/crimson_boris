@echo off
REM ============================================================
REM  CRIMSON BORIS - lancement Windows
REM
REM  Synchronise le code source avec le depot distant, recompile si
REM  necessaire, puis demarre l'application. Tout se fait en silence :
REM  la seule chose que l'operateur voit, c'est Boris qui s'ouvre.
REM
REM  Double-clic sur ce fichier, ou : boris.bat
REM ============================================================
setlocal enabledelayedexpansion

REM --- Localisation du projet ---------------------------------
REM Le script vit dans scripts\launch\ : la racine est deux niveaux au-dessus.
set "HERE=%~dp0"
pushd "%HERE%..\.." || exit /b 1
set "ROOT=%CD%"

set "LOG=%LOCALAPPDATA%\CrimsonBoris\launch.log"
if not exist "%LOCALAPPDATA%\CrimsonBoris" mkdir "%LOCALAPPDATA%\CrimsonBoris"
echo ===== %DATE% %TIME% lancement ===== >> "%LOG%"

REM Un echec de mise a jour ne doit JAMAIS empecher Boris de demarrer :
REM une panne de reseau laisse l'operateur avec sa version locale, ce qui
REM vaut infiniment mieux qu'un tableau de bord absent.
set "UPDATED=0"

REM --- 1 . Verification du depot distant ----------------------
where git >nul 2>&1
if errorlevel 1 (
  echo -- git introuvable, synchronisation ignoree >> "%LOG%"
  goto :build
)
if not exist ".git" (
  echo -- pas de depot git, synchronisation ignoree >> "%LOG%"
  goto :build
)

echo -- verification du depot >> "%LOG%"
for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%B"
if "%BRANCH%"=="" set "BRANCH=main"

git fetch --quiet origin %BRANCH% >> "%LOG%" 2>&1
if errorlevel 1 (
  echo !! depot injoignable, on continue sur la version locale >> "%LOG%"
  goto :build
)

for /f "delims=" %%L in ('git rev-parse HEAD 2^>nul') do set "LOCAL=%%L"
for /f "delims=" %%R in ('git rev-parse origin/%BRANCH% 2^>nul') do set "REMOTE=%%R"

if "%LOCAL%"=="%REMOTE%" (
  echo -- deja a jour >> "%LOG%"
  goto :build
)

echo -- version distante detectee >> "%LOG%"

REM Les modifications locales sont mises de cote plutot que perdues.
git diff --quiet >nul 2>&1
if errorlevel 1 (
  echo -- modifications locales mises de cote >> "%LOG%"
  git stash push --quiet --include-untracked -m "boris-launch" >> "%LOG%" 2>&1
)

git merge --ff-only origin/%BRANCH% --quiet >> "%LOG%" 2>&1
if errorlevel 1 (
  echo !! avance rapide impossible, la version locale est conservee >> "%LOG%"
) else (
  set "UPDATED=1"
  echo -- code source mis a jour >> "%LOG%"
)

REM --- 2 . Recompilation si le source a bouge -----------------
:build
set "NEEDS_BUILD=0"
if "%UPDATED%"=="1" set "NEEDS_BUILD=1"
if not exist "out\main\index.js" set "NEEDS_BUILD=1"

REM Un source plus recent que la compilation trahit une edition manuelle.
if exist "out\main\index.js" (
  for /f "delims=" %%F in ('dir /b /s /o-d "src\*.ts" "src\*.tsx" 2^>nul') do (
    call :newer "%%F" "out\main\index.js"
    goto :checked
  )
)
:checked

if "%NEEDS_BUILD%"=="0" (
  echo -- compilation a jour >> "%LOG%"
  goto :start
)

echo -- compilation necessaire >> "%LOG%"
where npm >nul 2>&1
if errorlevel 1 (
  echo !! npm introuvable, compilation impossible >> "%LOG%"
  goto :start
)

if "%UPDATED%"=="1" (
  call npm ci --silent >> "%LOG%" 2>&1 || call npm install --silent >> "%LOG%" 2>&1
)
call npm run build --silent >> "%LOG%" 2>&1
if errorlevel 1 (
  echo !! compilation en echec, on tente la version precedente >> "%LOG%"
) else (
  echo -- compilation terminee >> "%LOG%"
)

REM --- 3 . Demarrage ------------------------------------------
:start
set "INSTALLED=%LOCALAPPDATA%\Programs\crimson-boris\Crimson Boris.exe"
set "BUILT=%ROOT%\dist\win-unpacked\Crimson Boris.exe"

if exist "%INSTALLED%" (
  echo -- ouverture de l'application installee >> "%LOG%"
  start "" "%INSTALLED%"
  goto :done
)
if exist "%BUILT%" (
  echo -- ouverture de l'application compilee >> "%LOG%"
  start "" "%BUILT%"
  goto :done
)
if exist "out\main\index.js" (
  echo -- aucune application empaquetee, demarrage direct >> "%LOG%"
  start "" /b cmd /c "npx electron out\main\index.js"
  goto :done
)

echo !! rien a lancer >> "%LOG%"
echo Crimson Boris n'a pas pu demarrer. Journal : %LOG%
popd
exit /b 1

:done
echo -- demarre >> "%LOG%"
popd
exit /b 0

REM Compare deux horodatages de fichier ; positionne NEEDS_BUILD si %1 est plus recent.
:newer
for /f %%A in ('powershell -NoProfile -Command "if ((Get-Item '%~1').LastWriteTime -gt (Get-Item '%~2').LastWriteTime) { 1 } else { 0 }" 2^>nul') do (
  if "%%A"=="1" set "NEEDS_BUILD=1"
)
exit /b 0
