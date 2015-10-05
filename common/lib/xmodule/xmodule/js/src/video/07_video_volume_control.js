(function(define) {
'use strict';
// VideoVolumeControl module.
define(
'video/07_video_volume_control.js', [],
function() {
    /**
     * Video volume control module.
     * @exports video/07_video_volume_control.js
     * @constructor
     * @param {Object} state The object containing the state of the video
     * @param {Object} i18n The object containing strings with translations.
     * @return {jquery Promise}
     */
    var VolumeControl = function(state, i18n) {
        if (!(this instanceof VolumeControl)) {
            return new VolumeControl(state, i18n);
        }

        _.bindAll(this, 'keyDownHandler', 'updateVolumeSilently',
            'onVolumeChangeHandler', 'openMenu', 'closeMenu',
            'toggleMuteHandler', 'keyDownButtonHandler', 'destroy'
        );
        this.state = state;
        this.state.videoVolumeControl = this;
        this.i18n = i18n;
        this.initialize();

        return $.Deferred().resolve().promise();
    };

    VolumeControl.prototype = {
        /** Minimum value for the volume slider. */
        min: 0,
        /** Maximum value for the volume slider. */
        max: 100,
        /** Step to increase/decrease volume level via keyboard. */
        step: 20,

        template: [
            '<div class="volume">',
                '<button class="control" aria-disabled="false" aria-label="',
                    gettext('Click on this button to mute or unmute this video or press UP or DOWN buttons to increase or decrease volume level.'),
                    '">',
                    '<span class="icon-fallback-img">',
                        '<span class="icon fa fa-volume-up" aria-hidden="true"></span>',
                        '<span class="sr control-text">',
                            gettext('Volume'),
                        '</span>',
                    '</span>',
                '</button>',
                '<div role="presentation" class="volume-slider-container">',
                    '<div class="volume-slider"></div>',
                '</div>',
            '</div>'
        ].join(''),

        destroy: function () {
            this.volumeSlider.slider('destroy');
            this.state.el.find('iframe').removeAttr('tabindex');
            this.a11y.destroy();
            this.cookie = this.a11y = null;
            this.closeMenu();

            this.state.el
                .off('play.volume')
                .off({
                    'keydown': this.keyDownHandler,
                    'volumechange': this.onVolumeChangeHandler
                });
            this.el.off({
                'mouseenter': this.openMenu,
                'mouseleave': this.closeMenu
            });
            this.button.off({
                'mousedown': this.toggleMuteHandler,
                'keydown': this.keyDownButtonHandler,
                'focus': this.openMenu,
                'blur': this.closeMenu
            });
            this.el.remove();
            delete this.state.videoVolumeControl;
        },

        /** Initializes the module. */
        initialize: function() {
            var volume;

            if (this.state.isTouch) {
                // iOS doesn't support volume change
                return false;
            }

            this.el = $(this.template);
            // Youtube iframe react on key buttons and has his own handlers.
            // So, we disallow focusing on iframe.
            this.state.el.find('iframe').attr('tabindex', -1);
            this.button = this.el.children('.control');
            this.cookie = new CookieManager(this.min, this.max);
            this.a11y = new Accessibility(
                this.button, this.min, this.max, this.i18n
            );
            volume = this.cookie.getVolume();
            this.storedVolume = this.max;

            this.render();
            this.bindHandlers();
            this.setVolume(volume, true, false);
            this.checkMuteButtonStatus(volume);
        },

        /**
         * Creates any necessary DOM elements, attach them, and set their,
         * initial configuration.
         */
        render: function() {
            var container = this.el.find('.volume-slider');

            this.volumeSlider = container.slider({
                orientation: 'vertical',
                range: 'min',
                min: this.min,
                max: this.max,
                slide: this.onSlideHandler.bind(this)
            });

            // We provide an independent behavior to adjust volume level.
            // Therefore, we do not need redundant focusing on slider in TAB
            // order.
            container.find('a').attr('tabindex', -1);
            this.state.el.find('.secondary-controls').append(this.el);
        },

        /** Bind any necessary function callbacks to DOM events. */
        bindHandlers: function() {
            this.state.el.on({
                'keydown': this.keyDownHandler,
                'play.volume': _.once(this.updateVolumeSilently),
                'volumechange': this.onVolumeChangeHandler
            });
            this.el.on({
                'mouseenter': this.openMenu,
                'mouseleave': this.closeMenu
            });
            this.button.on({
                'click': false,
                'mousedown': this.toggleMuteHandler,
                'keydown': this.keyDownButtonHandler,
                'focus': this.openMenu,
                'blur': this.closeMenu
            });
            this.state.el.on('destroy', this.destroy);
        },

        /**
         * Updates volume level without updating view and triggering
         * `volumechange` event.
         */
        updateVolumeSilently: function() {
            this.state.el.trigger(
                'volumechange:silent', [this.getVolume()]
            );
        },

        /**
         * Returns current volume level.
         * @return {Number}
         */
        getVolume: function() {
            return this.volume;
        },

        /**
         * Sets current volume level.
         * @param {Number} volume Suggested volume level
         * @param {Boolean} [silent] Sets the new volume level without
         * triggering `volumechange` event and updating the cookie.
         * @param {Boolean} [withoutSlider] Disables updating the slider.
         */
        setVolume: function(volume, silent, withoutSlider) {
            if (volume === this.getVolume()) {
                return false;
            }

            this.volume = volume;
            this.a11y.update(this.getVolume());

            if (!withoutSlider) {
                this.updateSliderView(this.getVolume());
            }

            if (!silent) {
                this.cookie.setVolume(this.getVolume());
                this.state.el.trigger('volumechange', [this.getVolume()]);
            }
        },

        /** Increases current volume level using previously defined step. */
        increaseVolume: function() {
            var volume = Math.min(this.getVolume() + this.step, this.max);

            this.setVolume(volume, false, false);
        },

        /** Decreases current volume level using previously defined step. */
        decreaseVolume: function() {
            var volume = Math.max(this.getVolume() - this.step, this.min);

            this.setVolume(volume, false, false);
        },

        /** Updates volume slider view. */
        updateSliderView: function (volume) {
            this.volumeSlider.slider('value', volume);
        },

        /**
         * Mutes or unmutes volume.
         * @param {Number} muteStatus Flag to mute/unmute volume.
         */
        mute: function(muteStatus) {
            var volume;

            this.updateMuteButtonView(muteStatus);

            if (muteStatus) {
                this.storedVolume = this.getVolume() || this.max;
            }

            volume = muteStatus ? 0 : this.storedVolume;
            this.setVolume(volume, false, false);
        },

        /**
         * Returns current volume state (is it muted or not?).
         * @return {Boolean}
         */
        getMuteStatus: function () {
            return this.getVolume() === 0;
        },

        /**
         * Updates the volume button view.
         * @param {Boolean} isMuted Flag to use muted or unmuted view.
         */
        updateMuteButtonView: function(isMuted) {
            var action = isMuted ? 'addClass' : 'removeClass';

            this.el[action]('is-muted');
        },

        /** Toggles the state of the volume button. */
        toggleMute: function() {
            this.mute(!this.getMuteStatus());
        },

        /**
         * Checks and updates the state of the volume button relatively to
         * volume level.
         * @param {Number} volume Volume level.
         */
        checkMuteButtonStatus: function (volume) {
            if (volume <= this.min) {
                this.updateMuteButtonView(true);
                this.state.el.off('volumechange.is-muted');
                this.state.el.on('volumechange.is-muted', _.once(function () {
                     this.updateMuteButtonView(false);
                }.bind(this)));
            }
        },

        /** Opens volume menu. */
        openMenu: function() {
            this.el.addClass('is-opened');
        },

        /** Closes speed menu. */
        closeMenu: function() {
            this.el.removeClass('is-opened');
        },

        /**
         * Keydown event handler for the video container.
         * @param {jquery Event} event
         */
        keyDownHandler: function(event) {
            // ALT key is used to change (alternate) the function of
            // other pressed keys. In this case, do nothing.
            if (event.altKey) {
                return true;
            }

            if ($(event.target).hasClass('ui-slider-handle')) {
                return true;
            }

            var KEY = $.ui.keyCode,
                keyCode = event.keyCode;

            switch (keyCode) {
                case KEY.UP:
                    // Shift + Arrows keyboard shortcut might be used by
                    // screen readers. In this case, do nothing.
                    if (event.shiftKey) {
                        return true;
                    }

                    this.increaseVolume();
                    return false;
                case KEY.DOWN:
                    // Shift + Arrows keyboard shortcut might be used by
                    // screen readers. In this case, do nothing.
                    if (event.shiftKey) {
                        return true;
                    }

                    this.decreaseVolume();
                    return false;
            }

            return true;
        },

        /**
         * Keydown event handler for the volume button.
         * @param {jquery Event} event
         */
         keyDownButtonHandler: function(event) {
            // ALT key is used to change (alternate) the function of
            // other pressed keys. In this case, do nothing.
            if (event.altKey) {
                return true;
            }

            var KEY = $.ui.keyCode,
                keyCode = event.keyCode;

            switch (keyCode) {
                case KEY.ENTER:
                case KEY.SPACE:
                    this.toggleMute();

                    return false;
            }

            return true;
        },

        /**
         * onSlide callback for the video slider.
         * @param {jquery Event} event
         * @param {jqueryuiSlider ui} ui
         */
        onSlideHandler: function(event, ui) {
            this.setVolume(ui.value, false, true);
        },

        /**
         * Mousedown event handler for the volume button.
         * @param {jquery Event} event
         */
        toggleMuteHandler: function(event) {
            this.toggleMute();
            event.preventDefault();
        },

        /**
         * Volumechange event handler.
         * @param {jquery Event} event
         * @param {Number} volume Volume level.
         */
        onVolumeChangeHandler: function(event, volume) {
            this.checkMuteButtonStatus(volume);
        }
    };

    /**
     * Module responsible for the accessibility of volume controls.
     * @constructor
     * @private
     * @param {jquery $} button The volume button.
     * @param {Number} min Minimum value for the volume slider.
     * @param {Number} max Maximum value for the volume slider.
     * @param {Object} i18n The object containing strings with translations.
     */
    var Accessibility = function (button, min, max, i18n) {
        this.min = min;
        this.max = max;
        this.button = button;
        this.i18n = i18n;

        this.initialize();
    };

    Accessibility.prototype = {
        destroy: function () {
            this.liveRegion.remove();
        },

        /** Initializes the module. */
        initialize: function() {
            this.liveRegion = $('<div />', {
                'class':  'sr video-live-region',
                'role': 'status',
                'aria-hidden': 'false',
                'aria-live': 'polite',
                'aria-atomic': 'false'
            });

            this.button.after(this.liveRegion);
        },

        /**
         * Updates text of the live region.
         * @param {Number} volume Volume level.
         */
        update: function(volume) {
            this.liveRegion.text([
                this.getVolumeDescription(volume),
                this.i18n['Volume'] + '.'
            ].join(' '));
        },

        /**
         * Returns a string describing the level of volume.
         * @param {Number} volume Volume level.
         */
        getVolumeDescription: function(volume) {
            if (volume === 0) {
                return this.i18n['Muted'];
            } else if (volume <= 20) {
                return this.i18n['Very low'];
            } else if (volume <= 40) {
                return this.i18n['Low'];
            } else if (volume <= 60) {
                return this.i18n['Average'];
            } else if (volume <= 80) {
                return this.i18n['Loud'];
            } else if (volume <= 99) {
                return this.i18n['Very loud'];
            }

            return this.i18n['Maximum'];
        }
    };

    /**
     * Module responsible for the work with volume cookie.
     * @constructor
     * @private
     * @param {Number} min Minimum value for the volume slider.
     * @param {Number} max Maximum value for the volume slider.
     */
    var CookieManager = function (min, max) {
        this.min = min;
        this.max = max;
        this.cookieName = 'video_player_volume_level';
    };

    CookieManager.prototype = {
        /**
         * Returns volume level from the cookie.
         * @return {Number} Volume level.
         */
        getVolume: function() {
            var volume = parseInt($.cookie(this.cookieName), 10);

            if (_.isFinite(volume)) {
                volume = Math.max(volume, this.min);
                volume = Math.min(volume, this.max);
            } else {
                volume = this.max;
            }

            return volume;
        },

        /**
         * Updates volume cookie.
         * @param {Number} volume Volume level.
         */
        setVolume: function(value) {
            $.cookie(this.cookieName, value, {
                expires: 3650,
                path: '/'
            });
        }
    };

    return VolumeControl;
});
}(RequireJS.define));
