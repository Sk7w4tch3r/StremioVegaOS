#!/bin/sh
set -eu
cd "$(dirname "$0")"
: "${KEPLER_SDK_PATH:?Source the Vega SDK env first}"
toolroot="$KEPLER_SDK_PATH/workspace/env/VodkaClangArmv7-1.2/runtime"
export CC="$toolroot/mac/bin/clang --target=armv7-unknown-linux-gnueabihf --sysroot=$toolroot/sysroot-armv7"
export CXX="$toolroot/mac/bin/clang++ --target=armv7-unknown-linux-gnueabihf --sysroot=$toolroot/sysroot-armv7"
export GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=1
mkdir -p out
go build -trimpath -ldflags='-buildid=' -tags 'disable_libutp nosqlite' -buildmode=c-archive -o out/engine.a .
