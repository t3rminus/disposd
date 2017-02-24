'use strict';

const fs = require('fs'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter;

const ShairportReader = function(fileStream) {
	if(!(this instanceof ShairportReader)) {
		return new ShairportReader(fileStream);
	}
	const _this = this;
	
	_this.fileStream = fs.createReadStream(fileStream, { encoding: 'utf8' });
	_this.readBuffer = '';

	_this.metadata = {};
	_this.picture = null;

	_this.fileStream.on('data', function(data) {
		_this.readBuffer += data;
		let itemEnd, packet;
		while((itemEnd = _this.readBuffer.indexOf('</item>')) >= 0) {
			packet = _this.decodePacket(_this.readBuffer.slice(0, itemEnd + 7)); // 7 = ength of "</item>";
			_this.readBuffer = _this.readBuffer.slice(itemEnd + 7);
			console.log('packet',packet);
			if(packet.data) {
				switch (packet.code) {
					case 'mdst':
						_this.metadata = {};
						break;
					case 'asal':
						_this.metadata.albumName = packet.data;
						break;
					case 'asar':
						_this.metadata.artist = packet.data;
						break;
					case 'ascm':
						_this.metadata.comment = packet.data;
						break;
					case 'asgn':
						_this.metadata.genre = packet.data;
						break;
					case 'minm':
						_this.metadata.title = packet.data;
						break;
					case 'ascp':
						_this.metadata.composer = packet.data;
						break;
					case 'asdt':
						_this.metadata.fileKind = packet.data;
						break;
					case 'assn':
						_this.metadata.sortAs = packet.data;
						break;
					case 'mden':
						_this.emit('track', _this.metadata);
						break;
					case 'PICT':
						_this.picture = packet.data;
						_this.emit('picture', _this.picture);
						break;
				}
			}
		}
	});
};

util.inherits(ShairportReader, EventEmitter);
module.exports = ShairportReader;

ShairportReader.prototype.doTheMario = /<item>\s*<type>([^<]+?)<\/type>\s*<code>([^<]+?)<\/code>\s*<length>([^<]+?)<\/length>(?:\s*<data(?:.+)>([^<]+?)<\/data>)?\s*<\/item>/;
ShairportReader.prototype.decodePacket = function(data){
	console.log('raw',data);
	const match = this.doTheMario.exec(data);
	if(match && match[1]) {
		console.log('match',match);
		const result = {
			type: new Buffer(match[1],'hex').toString('utf-8'),
			code: new Buffer(match[2],'hex').toString('utf-8'),
			length: parseInt(match[3])
		};
		
		if(match[4] && result.code == 'PICT') {
			result.data = match[4];
		} else if(match[4]) {
			result.data = new Buffer(match[4],'base64').toString('utf-8');
		}
		return result;
	} else {
		return { type:'sprd', code: 'eror', length: 0 };
	}
};

/**
 * Here are the 'ssnc' codes defined so far:
 * -------
 * PICT -- the payload is a picture, either a JPEG or a PNG. Check the first few bytes to see which.
 * clip -- the payload is the IP number of the client, i.e. the sender of audio. Can be an IPv4 or an IPv6 number.
 * pbeg -- play stream begin. No arguments
 * pend -- play stream end. No arguments
 * pfls -- play stream flush. No arguments
 * prsm -- play stream resume. No arguments
 * pvol -- play volume. The volume is sent as a string -- "airplay_volume,volume,lowest_volume,highest_volume", where "volume", "lowest_volume" and "highest_volume" are given in dB. The "airplay_volume" is what's sent by the source (e.g. iTunes) to the player, and is from 0.00 down to -30.00, with -144.00 meaning "mute". This is linear on the volume control slider of iTunes or iOS AirPlay. If the volume setting is being ignored by Shairport Sync itself, the volume, lowest_volume and highest_volume values are zero.
 * prgr -- progress -- this is metadata from AirPlay consisting of RTP timestamps for the start of the current play sequence, the current play point and the end of the play sequence.
 * mdst -- a sequence of metadata is about to start. The RTP timestamp associated with the metadata sequence is included as data, if available.
 * mden -- a sequence of metadata has ended. The RTP timestamp associated with the metadata sequence is included as data, if available.
 * pcst -- a picture is about to be sent. The RTP timestamp associated with it is included as data, if available.
 * pcen -- a picture has been sent. The RTP timestamp associated with it is included as data, if available.
 * snam -- a device e.g. "Joe's iPhone" has started a play session. Specifically, it's the "X-Apple-Client-Name" string.
 * snua -- a "user agent" e.g. "iTunes/12..." has started a play session. Specifically, it's the "User-Agent" string.
 * stal -- this is an error message meaning that reception of a large piece of metadata, usually a large picture, has stalled; bad things may happen. The stalling phenomenon seems to be a bug in iTunes. *
 *
 * The next two two tokens are to facilitiate remote control of the source. There is some information at http://nto.github.io/AirPlay.html about remote control of the source.
 * -------
 * daid -- this is the source's DACP-ID (if it has one -- it's not guaranteed), useful if you want to remotely control the source. Use this string to identify the source's remote control on the network.
 * acre -- this is the source's Active-Remote token, necessary if you want to send commands to the source's remote control (if it has one).
 */