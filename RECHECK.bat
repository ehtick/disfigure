@echo off
rem next if is used to not close the window in case of error
if not defined in_subprocess (cmd /k set in_subprocess=y ^& %0 %*) & exit )

echo Eslinting src
call npx eslint --fix src/*.js

echo Eslinting src/utils
call npx eslint --fix src/utils/*.js

rem echo Eslinting poser
rem call npx eslint --fix poser/*.js
rem call npx eslint --fix poser/*.html

rem echo Eslinting examples
rem call npx eslint --fix examples/*.html
rem call npx eslint --fix examples/quaternions-prototype/*.js

pause
exit

