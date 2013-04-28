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
			if(_.isUndefined(this.audio)) return;
			else if(_.isArray(this.audio)) _.each(this.audio, function(howl) { howl.play(); });
			else this.audio.play();
		},

		pause : function() {
			if(_.isUndefined(this.audio)) return;
			else if(_.isArray(this.audio)) _.each(this.audio, function(howl) { howl.pause(); });
			else this.audio.pause();
		},

		fade : function(from, to, time, cb) {
			var self = this;
			if(_.isArray(this.audio)) _.each(this.audio, function(howl, index) {
				var _from = (from) ? from[index].volume : self.get('volume')[index].volume;
				howl.fade(_from, to, time, cb);
			});
			else {
				if(!from) from = this.audio.volume();
				this.audio.fade(from, to, time, cb);
			}
		},

		volume : function(v) {
			// an array means we've got a list of volume setters for currently playing tracks
			if (!v) {
				if(this.get('volume')) {
					var model = (_.isArray(this.audio)) ? this : window.app.getOriginalEvent();
					_.each(this.get('volume'), function(values, index) {
						_.defaults(values, {
							volume : 0.5,
							time : 300
						});

						if(values.time === 0) {
							model.audio[index].volume(values.volume);
						}
						else model.audio[index].fade(model.audio[index].volume(), values.volume, values.time);
					});
				}
			}
			// single howl
			else if(_.isArray(this.audio)) _.each(this.audio, function(howl) { howl.volume( howl.volume() + v ); });
			// group howl
			else if(this.audio) this.audio.volume( this.audio.volume() + v );
		},

		stop : function() {
			if(_.isArray(this.audio)) {
				_.each(this.audio, function(howl) {
					howl.stop();
				});
			}
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
			'click .restart' : 'restart',
			'click .vol.up' : function(e) {
				if(!this.model) return;
				this.model.volume(0.1);
			},
			'click .vol.down' : function(e) {
				if(!this.model) return;
				this.model.volume(-0.1);
			}
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

		runEvent : function(newModel) {
			if(this.loaded / this.totalTracks === 1) {
				// we're gonna fade out the old track if we're done with it
				if(this.model && ( this.model.get('fadeout') || !newModel.get('volume') )) {
					var vol = (this.model.get('fadevol')) ? this.model.get('fadevol') : 0,
						time = (this.model.get('fadeout')) ? this.model.get('fadeout') : 100,
						model = (this.model.audio) ? this.model : window.app.getOriginalEvent();

					if(model) {
						model.fade(this.model.get('volume'), vol, time, function() {
							model.stop();
							model.volume(1);
						});
					}
				}
				// play audio if it exists
				if(newModel.audio) newModel.play();
				else if(this.$('.play').length) this.play();

				// set items
				this.model = newModel;

				// set volumes if there are any to set
				if(this.model) this.model.volume();
				this.render();
			}
		},

		next : function() {
			if(this.loaded / this.totalTracks === 1) {
				var self = this,
					newModel = window.app.up.collection.shift();
				// push model onto queue
				if(this.model) window.app.past.collection.add(this.model, { at : 0 });
				if(newModel) this.runEvent(newModel);
				else {
					// last track
					this.model.stop();
					delete this.model;
					this.$('.current').html(templates.playerReady.render());
				}
			}
		},

		previous : function() {
			if(this.loaded / this.totalTracks === 1) {
				var self = this,
					newModel = window.app.past.collection.shift();

				// push model onto queue
				if(this.model) {
					window.app.up.collection.add(this.model, { at : 0 });
					this.model.stop();
				}

				if(newModel) {
					// if we're in the middle of stems
					if(newModel.get('volume')) {
						this.model = window.app.getOriginalEvent();
						this.model.stop();
						this.model.play();
						this.model.volume();
					}

					this.runEvent(newModel);
				} else {
					// first track
					this.model.stop();
					delete this.model;
					this.$('.current').html(templates.playerReady.render());
				}
			}
		},

		getTo : function(cid, stack) {
			if(this.loaded / this.totalTracks === 1) {
				var target = (_.isEqual(stack, window.app.past)) ? window.app.up : window.app.past,
					searching = true,
					newModel = this.model;

				while(searching) {
					if(newModel) target.collection.unshift(newModel);
					newModel = stack.collection.shift();
					searching = (newModel.cid !== cid);
				}

				target.render();
				stack.render();

				// stop all the things
				target.collection.each(function(model) { model.stop(); });
				stack.collection.each(function(model) { model.stop(); });
				newModel.stop();

				// if we're in the middle of stems
				if(newModel.get('volume') && !newModel.audio) {
					this.model = window.app.getOriginalEvent();
					this.model.play();
					_.each(this.model.audio, function(howl, index) {
						howl.volume(newModel.get('volume')[index].volume);
					});
				}

				this.runEvent(newModel);
			}
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
			if(!this.model) return;
			if (this.model.audio) this.model.pause();
			else window.app.getOriginalEvent().pause();
			this.$('.pause').toggleClass('pause play').text('Play');
		},

		play : function() {
			if(!this.model) return;
			if (this.model.audio) this.model.play();
			else window.app.getOriginalEvent().play();
			this.$('.play').toggleClass('pause play').text('Pause');
		},

		restart : function() {
			var model = (this.model.audio) ? this.model :window.app.getOriginalEvent();

			model.stop();
			model.play();
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
		},

		getOriginalEvent : function() {
			return this.past.collection.find(function(m) { return _.has(m, 'audio'); });
		}
	}),

	templates = {
		eventItem :
			'<li><a href="#" data-cid="{{ cid }}">{{ title }}</a> {{{ hasAudio }}}</li>',
		currentEvent :
			'<div class="panel">' +
				'<h3><a class="restart" href="#">{{ title }}</a></h3>' +
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
