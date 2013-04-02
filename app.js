var Player = Backbone.View.extend({
		events : {
			'click .next' : 'next'
		},

		next : function(ev) {
			ev.preventDefault();
			console.log(next);
		}
	}),

	Feed = Backbone.View.extend({});

	App = Backbone.View.extend({
		events : {
			'keypress' : 'handleKey'
		},

		initialize : function() {
			this.player = new Player({ el : '#player' });
			this.feed = new Feed({ el : '#events' });
		},

		handleKey : function(ev) {
			switch(ev.which) {
				case 32:
					this.player.next();
					break;
				default:
			}
		}
	});

$(function() {
	window.app = new App({el:'body'});
});
