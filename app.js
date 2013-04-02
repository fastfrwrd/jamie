var Player = Backbone.View.extend({
		el : '#player',
		events : {
			'click .next' : 'next'
		},

		next : function() {
			window.app.feed.push('abcde');
		}
	}),

	Feed = Backbone.View.extend({
		el : '#events',
		push : function(item) {
			this.$('.list').append($('<li />').text(item));
		}
	}),

	App = Backbone.View.extend({
		events : {
			'keypress' : 'handleKey'
		},

		initialize : function() {
			this.player = new Player();
			this.feed = new Feed();
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
