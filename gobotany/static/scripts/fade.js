/* Code for cross-fading a set of images. */

function fade_next_banner_image() {
    var FADE_DURATION = 2 * 1000;
    var BANNER_IMAGE_CSS = '#banner > img';
    // Successively fade in each hidden image.
    var fade = $(BANNER_IMAGE_CSS + ':hidden:first');
    if (fade.length > 0) {
        fade.fadeIn(FADE_DURATION);
    } else {
        // Start over: hide all but first and last again, then fade
        // the last out to the first.
        var images = $(BANNER_IMAGE_CSS);
        $(images).each(function(index) {
            if ((index !== 0) && (index !== images.length - 1)) {
                $(this).css('display', 'none');
            }
        });
        fade = $(BANNER_IMAGE_CSS + ':visible:last');
        fade.fadeOut(FADE_DURATION);
    }
}
