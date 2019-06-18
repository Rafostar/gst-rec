# gst-rec
[![npmjs](https://img.shields.io/badge/npmjs-repo-brightgreen.svg)](https://www.npmjs.com/package/gst-rec)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TFVDFD88KQ322)
[![Donate](https://img.shields.io/badge/Donate-PayPal.Me-lightgrey.svg)](https://www.paypal.me/Rafostar)

Universal screen recorder powered by GStreamer

## Installation
```
sudo npm install -g gst-rec
```
Requires [GStreamer-1.0](https://gstreamer.freedesktop.org) with `gst-launch-1.0` binary and following GStreamer1 plugins: base, good, bad, ugly.

## Usage
With default configuration `gst-rec` will record desktop and save it to `/tmp` directory.

### Examples
```
# Record 25 fps video and scale it to HD resolution:
gst-rec --video width=1280,height=720,fps=25,scaling=true

# Change encoding preset, video container, output file location and set custom filename:
gst-rec --preset ultrafast --format mp4 --file 'dir=/my/custom/path,name=My Awesome Recording'

# Record desktop with audio from pulseaudio sink:
gst-rec --audio device=alsa_output.pci-0000_00_01.1.hdmi-stereo.monitor

# Show list of system audio devices:
gst-rec --list-audio-devices

# Record to `~/Videos` directory as MP4 file with AAC audio from dev0:
gst-rec --audio device=dev0,encoder=faac --format mp4 --file dir=~/Videos

# Run GStreamer tcp server to allow connecting from multiple devices:
gst-rec --output server --server host=127.0.0.1,port=8080

# Create http server in addition to tcp server for devices that only support it:
gst-rec --output server --server port=8080 --http-port 8081

# Send scaled video output to `stdout` and receive it through `ffplay`:
gst-rec --video width=960,height=540,fps=30,scaling=true -o - | ffplay -fflags nobuffer -

# Run with default options, ignoring custom config file:
gst-rec --ignore-config

# Stream desktop to Chromecast using `castnow`:
gst-rec -o - | castnow --quiet -

# Stream desktop with audio to Chromecast:
gst-rec --audio device=dev0,encoder=lamemp3enc -o - | castnow --quiet -

# Alter default configuration and display it in JSON format (can be placed in config file):
gst-rec --preset superfast --video width=1280,height=720,fps=25,scaling=true --show-config

# Create new config file with default values:
gst-rec --ignore-config --show-config > ~/.config/gst-rec.json
```

Default configuration can be overwritten by `~/.config/gst-rec.json` config file.

Run `gst-rec --help` for list of all available options.

## Donation
If you like my work please support it by buying me a cup of coffee :grin:

[![PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=TFVDFD88KQ322)
