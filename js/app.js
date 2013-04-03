	// MODELS
var Event = Backbone.Model.extend({
		defaults : {
			title : 'Event',
			details : ['No details available'],
			next : function() {
				var model = window.app.up.collection.first();
				if(model) return model.get('title');
				else return false;
			}
		},

		initialize : function(options) {
			if(_.isObject(options.audio)) this.audio = new Howl(_.extend(options.audio, {
				onload : function() {
					window.app.player.loaded++;
					window.app.player.render();
				}
			}));
			Event.__super__.initialize.call(this, options);
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
		events : {
			'click .next' : 'next'
		},
		initialize : function(options) {
			Player.__super__.initialize.call(this, options);
			this.render();
		},
		next : function() {
			if(!_.isUndefined(this.model) && !_.isUndefined(this.model.audio)) {
				window.app.past.collection.add(this.model, { at : 0 });
				this.model.audio.stop();
			}
			this.model = window.app.up.collection.shift();
			if(!_.isUndefined(this.model) && !_.isUndefined(this.model.audio)) this.model.audio.play();
			this.render();
		},
		render : function() {
			var self = this,
				length = _.pluck(window.events, 'audio').length,
				html;

			if(this.model) html = templates.currentEvent.render(this.model.attributes);
			else if(this.loaded === length) {
				html = templates.playerReady.render();
				this.$('.next').unwrap();
			} else html = templates.playerLoading.render({ percent : (self.loaded / length) * 100 });


			this.$('.current').html(html);
		}
	}),

	Feed = Backbone.View.extend({
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
			'<li>{{ title }}</li>',
		currentEvent :
			'<div class="panel">' +
				'<h3>{{ title }}</h3>' +
				'<hr />' +
				'{{# time }}<div class="row">' +
					'<div class="large-3 columns"><strong class="right">Time</strong></div>' +
					'<div class="large-9 columns">{{ time }}</div>' +
				'</div>{{/ time }}' +
				'{{# startcue }}<div class="row">' +
					'<div class="large-3 columns"><strong class="right">Start Cue</strong></div>' +
					'<div class="large-9 columns">{{ startcue }}</div>' +
				'</div>{{/ startcue }}' +
				'{{# endcue }}<div class="row">' +
					'<div class="large-3 columns"><strong class="right">End Cue</strong></div>' +
					'<div class="large-9 columns">{{ endcue }}</div>' +
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
