// developed by Tom Jenkinson (github.com/tjenkinson) for LA1:TV (github.com/LA1TV)

(function ($) {
	
	$(document).ready(function() {
		// disable native text selection functionality
		$(document).disableSelection();
	});
	
	$(document).ready(function() {
		
		var webSocketAddress = 'ws://85.25.138.4:2346/ws';
		var authenticationPassword = "j3ev8uphlaclaMl6";
		
		var myCard = false;
		
		// backbone stuff
		var eventDispatcher = _.clone(Backbone.Events);
		addNumEnteredEvent(eventDispatcher);


		var CallCard = Backbone.Model.extend({
			initialize: function() {
				this.set("talkingTo", new CallCardCollection());
				this.set("callEnabled", myCard !== false);
				eventDispatcher.on("talkingUpdate", this.updateTalkingTo, this);
				eventDispatcher.on("cardChecked", this.cardChecked, this);
				eventDispatcher.on("cardUnchecked", this.cardUnchecked, this);
				eventDispatcher.on("myCardUpdated", function() {
					this.set("callEnabled", myCard !== false);
				}, this);
				var that = this;
				eventDispatcher.on("numEntered", function(a) {
					if (that.get("id") === a) {
						that.set("checked", !that.get("checked"));
					}
				});
				$(document).keydown(function(e) {
					if (!e.ctrlKey) {
						if (e.keyCode == 77) { //m
							if (myCard === that) {
								e.preventDefault();
								that.set("checked", !that.get("checked"));
							}
						}
						else if (e.keyCode == 84) { //t
							if (myCard === that) {
								e.preventDefault();
								that.checkAllTalkingTo();
							}
						}
						else if (e.keyCode == 74) { //j
							// only run if this is the only selected card
							if (mainCallCardCollection.getSelectedCards().length === 1 && that.get("checked")) {
								e.preventDefault();
								that.joinCard();
								mainCallCardCollection.checkAll(false);
								commandCompleted();
							}
						}
					}
				});
			},
			defaults: {
				id: null,
				name: null,
				checked: false,
				talkingTo: null, // will contain CallCardCollection containing call cards
				callEnabled: false
			},
			joinCard: function() {
				var cards = [this];
				_.each(this.get("talkingTo").models, function(card) {
					cards.push(card);
				}, this);
				linkPhones(cards, true);
			},
			callCard: function() {
				linkPhones([this], true);
			},
			disconnectCard: function() {
				disconnectPhones([this]);
			},
			updateTalkingTo: function(e) {
				// if list only contains this card then it will appear as holding
				
				// if group contains this card then show the group as the list
				if (_.contains(e, this)) {
					this.get("talkingTo").reset(_.filter(e, function(card){return card !== this;}, this));
				}
				// group does not contain this card
				else {
					// any cards that are in the group which are also in this talking to should be removed from this talking to
					_.each(e, function(card) {
						if (_.contains(this.get("talkingTo").models, card)) {
							// the card 'card' needs to be removed from talkingTo as now in another group
							this.get("talkingTo").remove(card);
						}
					}, this);
				}
			},
			cardChecked: function(e) {
				if (e.id === this.get("id")) {
					this.set("checked", true);
				}
			},
			cardUnchecked: function(e) {
				if (e.id === this.get("id")) {
					this.set("checked", false);
				}
			},
			checkAllTalkingTo: function() {
				var checking = false;
				_.every(this.get("talkingTo").models, function(card) {
					if (!card.get("checked")) {
						checking = true;
						return false; //break
					}
					return true; // make it continue
				}, this);
				_.each(this.get("talkingTo").models, function(card) {
					card.set("checked", checking);
				}, this);
			}
		});
		
		var CallCardCollection = Backbone.Collection.extend({
			model: CallCard,
			initialize: function() {},
			comparator: function(model) {
				return model.get("id");
			},
			getSelectedCards: function() {
				return _.filter(this.models, function(model) {
					return model.get("checked");
				}, this);
			},
			callSelected: function() {
				var selectedCards = this.getSelectedCards();
				linkPhones(selectedCards, true);
			},
			disconnectSelected: function() {
				var selectedCards = this.getSelectedCards();
				_.each(selectedCards, function(card) {
					disconnectPhones([card]);
				}, this);
			},
			linkSelected: function() {
				var selectedCards = this.getSelectedCards();
				linkPhones(selectedCards, false);
			},
			checkAll: function(check) {
				_.each(this.models, function(card) {
					card.set("checked", check);
				}, this);
			}
		});
		var mainCallCardCollection = new CallCardCollection();
		
		var AppView = Backbone.View.extend({
			el: $("body"),
			initialize: function() {
				this.$el.html($("#page").html());
				this.render();
				mainCallCardCollection.on("add remove", this.render, this);
				eventDispatcher.on("myCardUpdated", function() {this.enableCallButton(myCard !== false);}, this);
				var that = this;
				this.$el.find(".control-buttons .select-all-button").click(function() {
					mainCallCardCollection.checkAll(true);
				});
				this.$el.find(".control-buttons .select-none-button").click(function() {
					mainCallCardCollection.checkAll(false);
				});
				this.$el.find(".control-buttons .call-selected-button").click(function() {
					if (mainCallCardCollection.getSelectedCards().length === 0) {
						showNoSelectionMsg();
					}
					else {
						mainCallCardCollection.callSelected();
						mainCallCardCollection.checkAll(false);
						commandCompleted();
					}
				});
				this.$el.find(".control-buttons .disconnect-selected-button").click(function() {
					if (mainCallCardCollection.getSelectedCards().length === 0) {
						showNoSelectionMsg();
					}
					else {
						mainCallCardCollection.disconnectSelected();
						mainCallCardCollection.checkAll(false);
						commandCompleted();
					}
				});
				this.$el.find(".control-buttons .disconnect-you-button").click(function() {
					that.disconnectYou();
				});
				this.$el.find(".control-buttons .link-selected-button").click(function() {
					if (mainCallCardCollection.getSelectedCards().length === 0) {
						showNoSelectionMsg();
					}
					else {
						mainCallCardCollection.linkSelected();
						mainCallCardCollection.checkAll(false);
						commandCompleted();
					}
				});
				$(document).keydown(function(e) {
					if (!e.ctrlKey) {
						if (e.keyCode == 65) { //a
							e.preventDefault();
							mainCallCardCollection.checkAll(true);
						}
						else if (e.keyCode == 27) { //esc
							e.preventDefault();
							mainCallCardCollection.checkAll(false);
						}
						else if (e.keyCode == 78) { //n
							e.preventDefault();
							mainCallCardCollection.checkAll(false);
						}
						else if (e.keyCode == 67) { //c
							e.preventDefault();
							if (mainCallCardCollection.getSelectedCards().length === 0) {
								showNoSelectionMsg();
							}
							else {
								mainCallCardCollection.callSelected();
								mainCallCardCollection.checkAll(false);
								commandCompleted();
							}
						}
						else if (e.keyCode == 68) { //d
							e.preventDefault();
							if (mainCallCardCollection.getSelectedCards().length === 0) {
								showNoSelectionMsg();
							}
							else {
								mainCallCardCollection.disconnectSelected();
								mainCallCardCollection.checkAll(false);
								commandCompleted();
							}
						}
						else if (e.keyCode == 76) { //l
							e.preventDefault();
							if (mainCallCardCollection.getSelectedCards().length === 0) {
								showNoSelectionMsg();
							}
							else {
								mainCallCardCollection.linkSelected();
								mainCallCardCollection.checkAll(false);
								commandCompleted();
							}
						}
						else if (e.keyCode == 72) { //h
							e.preventDefault();
							that.disconnectYou();
						}
					}
					else {
						if (e.keyCode == 65) { // a
							e.preventDefault();
							mainCallCardCollection.checkAll(true);
						}
					}
				});
			},
			disconnectYou: function() {
				if (myCard !== false) {
					myCard.disconnectCard();
					commandCompleted();
				}
			},
			enableCallButton: function(val) {
				this.$el.find(".control-buttons .call-selected-button").prop("disabled", !val);
				this.$el.find(".control-buttons .disconnect-you-button").prop("disabled", !val);
			},
			render: function() {
				if (mainCallCardCollection.models.length === 0) {
					this.$el.find("#main-card-container").hide()
					this.$el.find("#no-calls-msg").show();
				}
				else {
					this.$el.find("#no-calls-msg").hide();
					this.$el.find("#main-card-container").show();
				}
				return this;
			}
		});
		var appView = new AppView();
		
		var PhoneSelectionCardOptionView = Backbone.View.extend({
			initialize: function() {
				this.$el = $(_.template($("#phone-selection-card-option").html(), {id: this.model.get("id"), name: this.model.get("name")}));
			}
		});
		
		var PhoneSelectionNoCardOptionView = Backbone.View.extend({
			$templateClone: $($("#phone-selection-no-card-option").html()),
			initialize: function() {
				this.$el = this.$templateClone;
			}
		});
		
		var PhoneSelectionContainerView = Backbone.View.extend({
			el: $("#phone-selection-container"),
			collection: mainCallCardCollection,
			$templateClone: $($("#phone-selection").html()),
			$theSelect: null,
			$noCardOption: null,
			cardViews: [],
			currentSelectId: null,
			initialize: function() {
				this.$theSelect = this.$templateClone.find(".phones-select").first();
				this.addNoCardItem();
				this.$theSelect.val("");
				this.updateCurrentSelectId();
				this.collection.on("add", function(model){this.addCardItem(model);}, this);
				this.collection.on("remove", function(model){this.removeCardItem(model);}, this);
				var that = this;
				this.$theSelect.change(function() {
					that.onSelectChanged();
				});
				this.$el.append(this.$templateClone);
			},
			onSelectChanged: function() {
				if (confirm("Are you sure you want to change this?")) {
					this.updateCurrentSelectId();
				}
				else {
					this.$theSelect.val(this.currentSelectId);
				}
			},
			updateCurrentSelectId: function() {
				this.currentSelectId = this.$theSelect.val();
				if (this.currentSelectId !== "") {
					setMyCard(this.collection.get(this.currentSelectId));
				}
				else {
					setMyCard(false);
				}
			},
			addNoCardItem: function() {
				var view = new PhoneSelectionNoCardOptionView();
				this.$noCardOption = view.$el;
				this.$theSelect.append(view.$el);
			},
			addCardItem: function(model) {
				var view = new PhoneSelectionCardOptionView({model: model});
				var index = _.indexOf(this.collection.models, model);
				var precedingView = false;
				for(var i=index-1; i>=0; i--) {
					precedingView = _.findWhere(this.cardViews, {model: this.collection.models[i]});
					break;
				}
				this.cardViews.push(view);
				if (precedingView !== false) {
					precedingView.$el.after(view.$el);
				}
				else {
					this.$noCardOption.after(view.$el);
				}
			},
			removeCardItem: function(card) {
				if (card.get("id") == this.currentSelectId) {
					this.$theSelect.val("");
					this.updateCurrentSelectId();
				}
				var view = _.findWhere(this.cardViews, {model: card});
				view.remove();
				this.cardViews.splice(_.indexOf(this.cardViews, view), 1);
			}
		});
		var phoneSelectionContainerView = new PhoneSelectionContainerView();
		
		
		
		var YouCardView = Backbone.View.extend({
			initialize: function() {
				this.$el = $(_.template($("#you-card").html(), {id: this.model.get("id"), name: this.model.get("name")}));
				this.setChecked(this.model.get("checked"));
				this.model.on("change:checked", function(){this.setChecked(this.model.get("checked"));}, this);
				var that = this;
				this.$el.find(".checkbox").change(function() {
					eventDispatcher.trigger($(this).prop("checked")?"cardChecked":"cardUnchecked", {id:that.model.get("id")});
				});
				this.$el.find(".disconnect-button").click(function() {
					disconnectPhones([that.model]);
					commandCompleted();
				});
			},
			setChecked: function(val) {
				this.$el.find(".checkbox").prop('checked', val);
			}
		});
		
		var YouContainerView = Backbone.View.extend({
			el: $("#you-container"),
			$templateClone: $($("#you").html()),
			initialize: function() {
				this.initialRender(false);
				eventDispatcher.on("myCardUpdated", function(lastMyCard) {this.initialRender(lastMyCard);}, this);
				this.$el.append(this.$templateClone);
				var that = this;
				this.$el.find(".check-all-button").click(function(){that.checkAll();});
			},
			myCardView: false,
			talkingToCardViews: [],
			initialRender: function(lastMyCard) {
				if (lastMyCard !== false) {
					// remove last event listeners
					lastMyCard.get("talkingTo").off("add remove reset", this.updateTalkingTo);
				}
				if (myCard === false) {
					this.$templateClone.hide();
				}
				else {
					if (this.myCardView !== false) {
						this.myCardView.remove();
					}
					this.myCardView = new YouCardView({model:myCard});
					this.$templateClone.find(".you-txt").append(this.myCardView.$el);
					
					this.updateTalkingTo();
					
					myCard.get("talkingTo").on("add remove reset", this.updateTalkingTo, this);
					
					this.$templateClone.show();
				}
			},
			checkAll: function() {
				myCard.checkAllTalkingTo();
			},
			updateTalkingTo: function() {
				this.removeTalkingToCard(false); // remove all views
				_.each(myCard.get("talkingTo").models, function(card) {
					this.addTalkingToCard(card);
				}, this);
			},
			addTalkingToCard: function(card) {
				this.$el.find(".no-one-txt").hide();
				this.$el.find(".check-all-button").show();
				var view = new YouCardView({model: card});
				var index = _.indexOf(myCard.get("talkingTo").models, card);
				var precedingView = false;
				for(var i=index-1; i>=0; i--) {
					if (myCard.get("talkingTo").models[i] !== myCard) {
						precedingView = _.findWhere(this.talkingToCardViews, {model: myCard.get("talkingTo").models[i]});
						break;
					}
				}
				this.talkingToCardViews.push(view);
				if (precedingView !== false) {
					precedingView.$el.after(view.$el);
				}
				else {
					this.$templateClone.find(".talking-txt").prepend(view.$el);
				}
			},
			removeTalkingToCard: function(card) {
				if (card === false) {
					// remove all
					var toRemove = [];
					_.each(this.talkingToCardViews, function(view) {
						toRemove.push(view);
					}, this);
					_.each(toRemove, function(view) {
						view.remove();
					}, this);
					this.talkingToCardViews = [];
				}
				else {
					// this will never happen in the current set up. might be useful in future
					var view = _.findWhere(this.talkingToCardViews, {model: card});
					view.remove();
					this.talkingToCardViews.splice(_.indexOf(this.talkingToCardViews, view), 1);
				}
				if (this.talkingToCardViews.length === 0) {
					this.$el.find(".check-all-button").hide();
					this.$el.find(".no-one-txt").show();
				}
			}
		});
		var youContainerView = new YouContainerView();
		
		var CallCardViewContainer = Backbone.View.extend({
			el: $("#call-card-wrapper"),
			collection: mainCallCardCollection,
			cardViews: [],
			initialize: function() {
				this.collection.on("add", function(model){
					if (myCard !== model) {
						this.addCard(model);
					}
				}, this);
				this.collection.on("remove", function(model){this.removeCard(model);}, this);
				eventDispatcher.on("myCardUpdated", function(lastCard) {
					if (myCard !== false) {
						this.removeCard(myCard);
					}
					if (lastCard !== false) {
						// check that the last card still exists
						if (_.contains(this.collection.models, lastCard)) {
							this.addCard(lastCard);
						}
					}					
				}, this);
			},
			// called from collection event
			addCard: function(model) {
				var view = new CallCardView({model: model});
				var index = _.indexOf(this.collection.models, model);
				var precedingView = false;
				for(var i=index-1; i>=0; i--) {
					if (this.collection.models[i] !== myCard) {
						precedingView = _.findWhere(this.cardViews, {model: this.collection.models[i]});
						break;
					}
				}
				this.cardViews.push(view);
				if (precedingView !== false) {
					precedingView.$el.after(view.$el);
				}
				else {
					this.$el.prepend(view.$el);
				}
			},
			removeCard: function(model) {
				var view = _.findWhere(this.cardViews, {model: model}); // DO NOTHING IF VIEW NOT FOUND. this can happen if the view is the myCard
				if (typeof view !== "undefined") {
					view.remove();
					this.cardViews.splice(_.indexOf(this.cardViews, view), 1);
				}
			}
		});
		var callCardViewContainer = new CallCardViewContainer();
		
		var CallCardView = Backbone.View.extend({
			talkingToEl: null,
			$talkingToEl: null,
			mouseIsOver: false,
			initialize: function() {
				this.$el = $(_.template($("#card").html(), {id: this.model.get("id"), name: this.model.get("name")}));
				this.$talkingToEl = $(talkingToEl = this.$el.find(".talking-table tbody").first());
				this.setChecked(this.model.get("checked"));
				this.updateTalkingTo(this.model.get("talkingTo"));
				this.setCallEnabled(this.model.get("callEnabled"));
				this.model.on("change:checked", function(){this.setChecked(this.model.get("checked"));}, this);
				this.model.on("change:callEnabled", function(){this.setCallEnabled(this.model.get("callEnabled"));}, this);
				this.model.get("talkingTo").on("add remove reset", function(){this.updateTalkingTo(this.model.get("talkingTo"));}, this);
				var that = this;
				this.$el.find(".top-bar .checkbox").click(function(e) {e.stopPropagation();});
				this.$el.find(".top-bar .checkbox").change(function(e) {
					e.stopPropagation();
					eventDispatcher.trigger($(this).prop("checked")?"cardChecked":"cardUnchecked", {id:that.model.get("id")});
				});
				this.$el.find(".top-bar").click(function() {
					eventDispatcher.trigger(!$(this).find(".checkbox").prop("checked")?"cardChecked":"cardUnchecked", {id:that.model.get("id")});
				});
				this.$el.find(".top-bar .call-button").click(function(e) {
					e.stopPropagation();
					that.model.callCard();
					commandCompleted();
				});
				this.$el.find(".top-bar .join-button").click(function(e) {
					e.stopPropagation();
					that.model.joinCard();
					commandCompleted();
				});
				this.$el.find(".check-buttons .check-all-button").click(function(){that.checkAll();});
				this.$el.hover(function() {
					that.mouseIsOver = true;
					that.updateState();
				}, function() {
					that.mouseIsOver = false;
					that.updateState();
				});
			},
			updateState: function() {
				var state = "";
				if (this.model.get("checked")) {
					state = "selected";
				}
				else if (this.mouseIsOver) {
					state = "hover";
				}
				this.$el.find(".top-bar").attr("data-state", state);
			},
			setChecked: function(val) {
				this.$el.find(".top-bar .checkbox").prop('checked', val);
				this.updateState();
			},
			setCallEnabled: function(val) {
				this.$el.find(".top-bar .call-button").prop("disabled", !val);
				this.$el.find(".top-bar .join-button").prop("disabled", !val);
			},
			checkAll: function() {
				this.model.checkAllTalkingTo();
			},
			updateTalkingTo: function(val) {
				if(val.models.length === 0) {
					this.$el.find(".talking-table-container").hide();
					this.$el.find(".no-calls-msg").show();
				}
				else {
					this.$el.find(".no-calls-msg").hide();
					this.$el.find(".talking-table-container").show();
					this.$talkingToEl.html(""); // might be better way
					var that = this;
					_.forEach(val.models, function(model, i) {
						var view = new TalkingTableRowView({model: model});
						that.$talkingToEl.append(view.$el); // probably better way
					});
				}
			}
		});
		
		var TalkingTableRowView = Backbone.View.extend({
			initialize: function() {
				this.$el = $(_.template($("#talking-table-row").html(), {id: this.model.get("id"), name: this.model.get("name")}));
				this.setChecked(this.model.get("checked"));
				this.model.on("change:checked", function(){this.setChecked(this.model.get("checked"));}, this);
				var that = this;
				this.$el.find(".row-checkbox .checkbox").click(function(e) {e.stopPropagation();});
				this.$el.find(".row-checkbox .checkbox").change(function(e) {
					e.stopPropagation();
					eventDispatcher.trigger($(this).prop("checked")?"cardChecked":"cardUnchecked", {id:that.model.get("id")});
				});
				this.$el.click(function() {
					eventDispatcher.trigger(!$(this).find(".row-checkbox .checkbox").prop("checked")?"cardChecked":"cardUnchecked", {id:that.model.get("id")});
				});
				this.$el.find(".disconnect-button .btn").click(function(e) {
					e.stopPropagation();
					that.model.disconnectCard();
					commandCompleted();
				});
			},
			setChecked: function(val) {
				this.$el.find(".checkbox").prop('checked', val);
			}
		});
		
		// if a card is removed and this is myCard. set myCard to false. also put removed card in holding first
		mainCallCardCollection.on("remove", function(card) {
			if (card === myCard) {
				setMyCard(false);
			}
			eventDispatcher.trigger("talkingUpdate", [card]);
		});
		
		function setMyCard(card) {
			var lastMyCard = myCard;
			myCard = card;
			eventDispatcher.trigger("myCardUpdated", lastMyCard);
		}
		
		var socket;
		var connected = false;
		var kickOffSocket = function() {
			
			function connect() {
				console.log("Attempting to connect to socket...");
				try {
					socket = new WebSocket(webSocketAddress);
					socket.onopen = function() {
						connected = true;
						console.log("Connected to socket!");
						var data = {action:"authenticate", payload:authenticationPassword};
						socket.send(JSON.stringify(data));
						// initial data will be requested after authentication response
					};
					socket.onmessage = function(e) {
						var responses = jQuery.parseJSON(e.data);
						console.log("Received socket data: "+e.data);
						hadActivity = true;
						_.each(responses, function(response) {
							if (response.code === 0) {
								var payload = response.payload;
								// command executed successfully
								if (payload.action == "authenticated") {
									// now request initial data
									var data = {action:"getInitialData", payload:false};
									socket.send(JSON.stringify(data));
								}
								else if (payload.action == "connection") {
									onPhoneAdded(payload.id, payload.name);
								}
								else if (payload.action == "disconnection") {
									onPhoneDisconnected(payload.id);
								}
								else if (payload.action == "linking") {
									onPhonesLinked(payload.ids);
								}
								else if (payload.action == "pingResponse") {}
							}
							else {
								console.log("A command failed to execute on the server returning error code "+response.code+".");
							}
						}, this);
					};
					socket.onclose = function() {
						connected = false;
						console.log("Connection to socket lost.");
						reset();
						tryAgain();
					};
					socket.onerror = function() {
						// onClose will always be called on error
					};
				}
				catch(e) {
					tryAgain();
				}
			
			}
			
			function tryAgain() {
				// try again in roughly 8 seconds.
				setTimeout(_.bind(function(){connect();}, this), 8000+(Math.random()*5000));
			}
			
			connect();
			
			// send ping every 10 seconds to make sure still connected
			var hadActivity = false;
			setInterval(function() {
				if (!connected) {
					return;
				}
				if (!hadActivity) {
					console.log("Had no reply from server in the last 10 seconds. Presuming disconnected.");
					// not received reply in 10 seconds. presume disconnected
					socket.close();
				}
				else {
					var data = {action:"ping", payload:false};
					hadActivity = false;
					socket.send(JSON.stringify(data));
				}
			}, 10000);
		
		};
		
		
		function showNoSelectionMsg() {
			alert("You haven't selected anything.");
			return;
		}
		
		function commandCompleted() {
			$("body").effect("highlight", {color: "#33CC33"}, 500);
		}
		
		function linkPhones(cards, includeMyCard) {
			if (includeMyCard && myCard !== false) {
				//add my phone if not already in group
				if (!_.contains(cards, myCard)) {
					cards.push(myCard);
				}
			}
			
			var data = {action:"link", payload:[]};
			_.each(cards, function(card) {
				data.payload.push(card.get("id"));
			}, this);
			socket.send(JSON.stringify(data));
		}
		
		function disconnectPhones(cards) {
			var data = {action:"disconnect", payload:[]};
			_.each(cards, function(card) {
				data.payload.push(card.get("id"));
			}, this);
			socket.send(JSON.stringify(data));
		}
		
		function onPhoneAdded(id, name) {
			// make sure that a phone can't end up being added twice
			if (_.where(mainCallCardCollection.models, {id: id}).length === 0) {
				mainCallCardCollection.add(new CallCard({id: id, name:name}));
			}
		}
		
		function onPhoneDisconnected(id) {
			var card = _.findWhere(mainCallCardCollection.models, {id: id});
			if (typeof card !== "undefined") {
				mainCallCardCollection.remove(card);
			}
		}
		function onPhonesLinked(ids) {
			var cards = [];
			_.each(ids, function(id) {
				cards.push(mainCallCardCollection.get(id));
			}, this);
			eventDispatcher.trigger("talkingUpdate", cards);
		}
		
		function reset() {
			// remove all cards
			var toRemove = [];
			_.each(mainCallCardCollection.models, function(card) {
				toRemove.push(card);
			}, this);
			_.each(toRemove, function(card) {
				mainCallCardCollection.remove(card);
			}, this);
		}
		
		
		
		
		kickOffSocket();
			
	});
})(jQuery);