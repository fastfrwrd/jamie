	// MODELS
var Event = Backbone.Model.extend({
		defaults : {
			title : 'Event',
			details : ['No details available'],
			next : function() {
				var model = window.app.up.collection.first();
				if(model) return model.get('title');
				else return false;
			},

			previous : function() {
				var model = window.app.past.collection.first();
				if(model) return model.get('title');
				else return false;
			},

			hasAudio : function() {
				return (!_.isUndefined(this.volume) || !_.isUndefined(this.audio)) ? "&#9835;" : "";
			}
		},

		initialize : function(options) {
			if(_.isObject(options.audio) || _.isArray(options.audio)) this.audio = this._setupTrack(options.audio);
			Event.__super__.initialize.call(this, options);
			this.set('cid', this.cid);
		},

		play : function() {
			if(_.isUndefined(this.audio) || this.get('noStop')) return;
			else if(_.isArray(this.audio)) _.each(this.audio, function(howl) { howl.play(); });
			else this.audio.play();
		},

		pause : function() {
			if(_.isUndefined(this.audio)) return;
			else if(_.isArray(this.audio)) _.each(this.audio, function(howl) { howl.pause(); });
			else this.audio.pause();
		},

		fade : function(from, to, time, cb) {
			if(_.isArray(this.audio)) _.each(this.audio, function(howl) {
				if(_.isNull(from)) from = howl.volume();
				howl.fade(from, to, time, cb);
			});
			else {
				var self = this;
				if(_.isNull(from)) from = this.audio.volume();
				this.audio.fade(from, to, time, cb);
			}
		},

		stop : function() {
			if(_.isArray(this.audio)) _.each(this.audio, function(howl) { howl.stop(); });
			else if(this.audio) this.audio.stop();
		},

		_setupTrack : function(audio) {
			if(_.isArray(audio)) {
				return _.map(audio, this._setupTrack);
			} else {
				return new Howl(_.extend(audio, {
					onload : function() {
						window.app.player.loaded++;
						window.app.player.render();
					},
					onend : function(e) {
						var m = window.app.player.model;
						if(m && m.audio && !_.isArray(m.audio) && !m.audio._loop) window.app.player.next();
					}
				}));
			}
		}
	}),

	// COLLECTIONS
	Events = Backbone.Collection.extend({
		model : Event
	}),

	// VIEWS
	Player = Backbone.View.extend({
		el : '#player',
		loaded: 0,
		totalTracks : 0,
		events : {
			'click .next' : 'next',
			'click .prev' : 'previous',
			'click .play' : 'play',
			'click .pause' : 'pause',
			'click .mute' : 'mute',
			'click .unmute' : 'unmute',
			'click .vol.up' : function(e) { this.volume(0.1); },
			'click .vol.down' : function(e) { this.volume(-0.1); }
		},
		initialize : function(options) {
			var self = this;
			_.each(window.events, function(e) {
				if(_.isArray(e.audio)) self.totalTracks += e.audio.length;
				else if(!_.isUndefined(e.audio)) self.totalTracks++;
			});
			Player.__super__.initialize.call(this, options);
			this.render();
		},

		runEvent : function(newModel, oldModel) {
			if(this.loaded / this.totalTracks === 1) {
				// there's a new model in town
				this.model = newModel;
				// if we need to keep going, handle volume changes and put old model audio onto new model audio
				if(newModel && newModel.get('volume')) {
					if(oldModel) {
						newModel.audio = oldModel.audio;
					} else {
						this.model.play();
					}
				}
				// we're gonna fade out the old track otherwise
				else {
					if(oldModel && oldModel.audio && !newModel.get('volume')) {
						var vol = (oldModel.get('fadevol')) ? oldModel.get('fadevol') : 0,
							time = (oldModel.get('fadeout')) ? oldModel.get('fadeout') : 100;

						oldModel.fade(null, vol, time, function() {
							oldModel.stop();
							oldModel.audio.volume(1);
						});
					}
					// play audio if it exists
					if(this.model) this.model.play();
				}
				// set volumes if there are any to set
				if(this.model) this.volume(this.model.get('volume'));
				this.render();
			}
		},

		next : function() {
			if(this.loaded / this.totalTracks === 1) {
				var self = this,
					oldModel = this.model,
					newModel = window.app.up.collection.shift();
				// push model onto old queue
				if(oldModel) window.app.past.collection.add(oldModel, { at : 0 });
				this.runEvent(newModel, oldModel);
			}
		},

		previous : function() {
			if(this.loaded / this.totalTracks === 1) {
				if(this.model) this.model.stop();

				var self = this,
					newModel = window.app.past.collection.shift();

				// push model onto old queue
				if(this.model) window.app.up.collection.add(this.model, { at : 0 });

				// if we're in the middle of stems
				if(newModel.get('volume') && !newModel.audio) {
					newModel.audio = window.app.past.collection.find(function(m) { return _.has(m, 'audio'); }).audio;
				}
				this.runEvent(newModel);
			}
		},

		getTo : function(cid, stack) {
			if(this.loaded / this.totalTracks === 1) {
				if(this.model) this.model.stop();

				var target = (_.isEqual(stack, window.app.past)) ? window.app.up : window.app.past,
					searching = true,
					newModel = this.model,
					oldModel;

				while(searching) {
					if(newModel) target.collection.unshift(newModel);
					newModel = stack.collection.shift();
					searching = (newModel.cid !== cid);
				}

				target.render();
				stack.render();

				// if we're in the middle of stems
				if(newModel.get('volume') && !newModel.audio) {
					newModel.audio = target.collection.find(function(m) { return _.has(m, 'audio'); }).audio;
				}

				this.runEvent(newModel);
			}
		},

		volume : function(v) {
			var self = this;
			// an array means we've got a list of volume setters for currently playing tracks
			if (_.isArray(v) && _.isArray(this.model.audio)) {
				_.each(v, function(values, index) {
					_.defaults(values, {
						volume : 0.5,
						time : 300
					});

					if(values.time === 0) self.model.audio[index].volume(values.volume);
					else self.model.audio[index].fade(self.model.audio[index].volume(), values.volume, values.time);
				});
			}
			// single howl
			else if(_.isObject(this.model.audio)) this.model.audio.volume( this.model.audio.volume() + v );
			// group howl
			else _.each(this.model.audio, function() { this.volume( this.volume() + v ); });
		},

		mute : function() {
			Howler.mute();
			this.$('.mute').toggleClass('mute unmute alert secondary').text('Unmute');
		},

		unmute : function() {
			Howler.unmute();
			this.$('.unmute').toggleClass('mute unmute alert secondary').text('Mute');
		},

		pause : function() {
			this.model.pause();
			this.$('.pause').toggleClass('pause play').text('Play');
		},

		play : function() {
			this.model.play();
			this.$('.play').toggleClass('pause play').text('Pause');
		},

		render : function() {
			var self = this,
				html;

			if(this.model) html = templates.currentEvent.render(this.model.attributes);
			else if(this.loaded === this.totalTracks) {
				html = templates.playerReady.render();
				this.$('.button-bar').removeClass('hide');
			} else html = templates.playerLoading.render({ percent : (self.loaded / self.totalTracks) * 100 });

			this.$('.current').html(html);
		}
	}),

	Feed = Backbone.View.extend({
		events : {
			'click a' : 'launch'
		},
		initialize : function(options) {
			var self = this;
			Feed.__super__.initialize.call(this, options);
			this.render();
			this.collection.on('add', function() { self.render(); });
			this.collection.on('remove', function() { self.render(); });
		},
		render : function() {
			var self = this;
			this.$('ul').empty();
			this.collection.each(function(model) { self.push(model); });
		},
		push : function(model) {
			this.$('ul').append(templates.eventItem.render(model.attributes));
		},
		launch : function(e) {
			e.preventDefault();
			var self = this;
			window.app.player.getTo($(e.target).attr('data-cid'), self);
		}
	}),

	App = Backbone.View.extend({
		events : {
			'keypress' : 'handleKey'
		},

		initialize : function(options) {
			var self = this;
			this.player = new Player();
			this.up = new Feed({ el : '#up', collection : new Events(window.events) });
			this.past = new Feed({ el : '#past', collection : new Events() });
		},

		handleKey : function(ev) {
			switch(ev.which) {
				case 32:
					this.player.next();
					break;
				default:
					break;
			}
		}
	}),

	templates = {
		eventItem :
			'<li><a href="#" data-cid="{{ cid }}">{{ title }}</a> {{{ hasAudio }}}</li>',
		currentEvent :
			'<div class="panel">' +
				'<h3>{{ title }}</h3>' +
				'<hr />' +
				'{{# time }}<div class="row">' +
					'<div class="large-3 columns"><strong class="right">Time</strong></div>' +
					'<div class="large-9 columns">{{ time }}</div>' +
				'</div>{{/ time }}' +
				'{{# endcue }}<div class="row">' +
					'<div class="large-3 columns"><strong class="right">End Cue</strong></div>' +
					'<div class="large-9 columns">{{{ endcue }}}</div>' +
				'</div>{{/ endcue }}' +
				'{{# next }}<div class="row">' +
					'<div class="large-3 columns"><strong class="right">Next</strong></div>' +
					'<div class="large-9 columns">{{ next }}</div>' +
				'</div>{{/ next }}' +
			'</div>',
		playerLoading :
			'<h5>Loading audio...</h5>' +
			'<div class="progress"><span class="meter" style="width:{{ percent }}%"></span></div>',
		playerReady :
			'<div class="panel"><h3>Player ready!</h3></div>'
	};

_.each(templates, function(value, key) { templates[key] = Hogan.compile(value); });

$(function() {
	$.getJSON('events.json', function(data) {
		window.events = data;
		window.app = new App({el:'body'});
	});
});
