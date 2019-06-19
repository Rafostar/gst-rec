#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const debug = require('debug')('gst-rec');
const parseArgs = require('minimist');
const express = require('express');
const net = require('net');
const homedir = require('os').homedir();
const gstRecorder = require('gstreamer-recorder');
const confLocation = '.config/gst-rec.json';
const confPath = path.join(homedir, confLocation);

var recorder = new gstRecorder({ output: 'file' });
debug('Created new gstreamer-recorder object');

var opts = {
	boolean: ['ignore-config', 'show-config', 'list-audio-devices', 'version', 'help'],
	string: [...Object.keys(recorder.opts), ...['http-port']],
	alias: { o: 'output', h: 'help', gstPath: 'gst-path' }
};
var args = process.argv.slice(2);
var argv = parseArgs(args, opts);
debug(`\nObtained command line args: ${JSON.stringify(argv, null, 2)}\n`);

if(argv.help)
	return showHelp();

if(argv.version)
	return console.log(getVersion());

if(argv['list-audio-devices'])
{
	var audioList = recorder.getAudioDevices();
	return console.log(JSON.stringify(audioList, null, 2));
}

getCmdOpts();

if(argv['show-config'])
{
	if(recorder.opts.hasOwnProperty('verbose'))
		delete recorder.opts.verbose;

	return console.log(JSON.stringify(recorder.opts, null, 2));
}

process.on('SIGINT', () => shutDown());
process.on('SIGTERM', () => shutDown());
process.on('uncaughtException', (err) => shutDown(err));

startRecording();

function getCmdOpts()
{
	if(!argv['ignore-config'])
	{
		debug('Searching for config file...');
		if(fs.existsSync(confPath))
		{
			debug('Config file found');
			var config = fs.readFileSync(confPath);

			try {
				config = JSON.parse(config);
				recorder.opts = recorder.getOptions(recorder.opts, config);
				debug('Successfully applied config from file');
			}
			catch(err) {
				console.error(`Could not parse config file! Reason: ${err.message}`);
			}
		}
		else
			debug('Config file not found');
	}

	if(argv.output === '-')
		argv.output = 'stdout';

	for(var key in recorder.opts)
	{
		if(argv.hasOwnProperty(key) && recorder.opts[key] instanceof Object)
		{
			var params = argv[key].split(',');
			argv[key] = {};
			params.forEach(option =>
			{
				var pair = option.split('=');
				if(pair.length === 2)
				{
					pair[0] = pair[0].split(' ').join('');
					var value = pair[1] == 'true' ? true :
						pair[1] == 'false' ? false :
						pair[1] == 'null' ? null :
						pair[1];

					argv[key][pair[0]] = value;
				}
			});
		}
	}

	recorder.opts = recorder.getOptions(recorder.opts, argv);
	debug('Applied command line options');

	var audioSrc = recorder.opts.audio.device;
	if(	typeof audioSrc === 'string'
		&& audioSrc.substring(0, 3) === 'dev'
		&& Number.isInteger(parseInt(audioSrc.substring(3)))
	) {
		debug(`Searching for audio device with id: ${audioSrc}`);
		var audioDevices = recorder.getAudioDevices();

		if(audioDevices)
			recorder.opts.audio.device = audioDevices.hasOwnProperty(audioSrc) ? audioDevices[audioSrc] : null;

		if(recorder.opts.audio.device !== null)
			debug(`Found audio device: ${recorder.opts.audio.device}`);
		else
			console.error('Requested audio device not found!');
	}
}

function startRecording()
{
	debug(`\nStarting recording with options: ${JSON.stringify(recorder.opts, null, 2)}\n`);

	if(recorder.opts.output === 'stdout')
		return recorder.start().pipe(process.stdout);

	recorder.start();

	switch(recorder.opts.output)
	{
		case('server'):
			console.log(`Running tcp server on port: ${recorder.opts.server.port}`);
			if(argv['http-port'])
			{
				const port = parseInt(argv['http-port']);
				if(port)
				{
					createHttpServer(port);
					console.log(`Running http server on port: ${port}`);
				}
			}
			break;
		case('file'):
			if(recorder.opts.file.name !== null)
			{
				var extension = (recorder.opts.format === 'matroska') ? '.mkv' : '.mp4';
				var filepath = path.join(recorder.opts.file.dir, recorder.opts.file.name + extension);
				console.log(`Recording to file: "${filepath}"`);
			}
			else
				console.log(`Recording with auto-generated filename to: "${recorder.opts.file.dir}"`);
			break;
		default:
			break;
	}

	console.log('Press Ctrl+c to stop');
}

function createHttpServer(port)
{
	var app = express();
	var server = app.listen(port).on('error', (err) => shutDown(err));

	app.get('/', function(req, res)
	{
		var socket = net.createConnection({
			port: recorder.opts.server.port,
			host: recorder.opts.server.host
		});

		socket.once('connect', () =>
		{
			debug('New client connected to http server');

			var type = (recorder.opts.format === 'matroska') ? 'x-matroska' : 'mp4';

			res.setHeader('Content-Type', `video/${type}`);
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Connection', 'keep-alive');
			res.statusCode = 200;

			socket.on('data', data => res.write(data));
		});
	});
}

function showHelp()
{
	console.log([
		``,
		`gst-rec ${getVersion()}, universal screen recorder powered by GStreamer`,
		`Usage: gst-rec [OPTIONS]`,
		``,
		`Options:`,
		`  -o, --output <mode>           Set output mode: file | server | stdout (default: file)`,
		`  --ignore-config               Do not read the user configuration in ~/${confLocation}`,
		`  --show-config                 Only displays currently applied configuration and exits`,
		`  --list-audio-devices          Shows list of audio sources obtained from "pacmd" in JSON format`,
		`  --gst-path <path>             Path to gst-launch-1.0 binary (default: ${recorder.opts.gstPath})`,
		`  --preset <name>               Encoding speed preset: ultrafast | superfast (default: ${recorder.opts.preset})`,
		`  --format <container>          Used media container: matroska | mp4 (default: ${recorder.opts.format})`,
		`  --http-port <port>            Create simple http server besides GStreamer tcp server (only when output: server)`,
		`  --pipewire <key=value,...>`,
		`      path=<value>              Pipewire source path`,
		`  --video <key=value,...>`,
		`      width=<value>             Horizontal video resolution - ignored when scaling is disabled (default: ${recorder.opts.video.width})`,
		`      height=<value>            Vertical video resolution - ignored when scaling is disabled (default: ${recorder.opts.video.height})`,
		`      fps=<value>               Video frames per second (default: ${recorder.opts.video.fps})`,
		`      mbps=<value>              Bitrate in Mbits/sec (default: ${recorder.opts.video.mbps})`,
		`      scaling=<bool>            Enable video scaling: true | false (default: ${recorder.opts.video.scaling})`,
		`      borders=<bool>            Add black borders to keep aspect ratio: true | false (default: ${recorder.opts.video.borders})`,
		`  --audio <key=value,...>`,
		`      device=<name>             Set pulseaudio source device (default: ${recorder.opts.audio.device} = no sound)`,
		`      buffer=<value>            Size of audio buffer in microseconds (default: ${recorder.opts.audio.buffer})`,
		`      encoder=<name>            GStreamer audio encoder name (default: ${recorder.opts.audio.encoder} = copy sound)`,
		`  --server <key=value,...>`,
		`      host=<ip>                 Local host IP adress (default: ${recorder.opts.server.host})`,
		`      port=<port>               Port used for running GStreamer tcp server (default: ${recorder.opts.server.port})`,
		`  --file <key=value,...>`,
		`      dir=<path>                Path to directory for saving screen records (default: ${recorder.opts.file.dir})`,
		`      name=<filename>           Current capture filename without extension (default: ${recorder.opts.file.name} = auto-generated)`,
		`  --version                     Show current app version`,
		`  -h, --help                    This help screen`,
		``
	].join('\n'));
}

function getVersion()
{
	var pkg = require('./package.json');
	return pkg.version;
}

function shutDown(err)
{
	if(recorder.process)
		recorder.stop();

	if(err)
	{
		if(err.code != 'EPIPE')
			console.error(err.message);

		process.exit(1);
	}

	process.stderr.write('\n');
	process.exit(0);
}
