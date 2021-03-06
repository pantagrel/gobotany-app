define([
    'bridge/jquery', 
    'bridge/jquery.form',
    'plantshare/upload_modal',
    'mapping/geocoder',
    'util/shadowbox_init'
], function ($, jqueryForm, upload_modal, Geocoder, Shadowbox) {

    var UPLOAD_SPINNER = '/static/images/icons/preloaders-dot-net-lg.gif';
    var DELETE_ICON = '/static/images/icons/close.png';

    $(document).ready(function () {

        function addNewThumb(thumb_url, full_url, id) {
            // Set the last image's url, which should be the spinner,
            // to the real image url.
            var $lastImage = $('.thumb-gallery img.thumb').last();
            $lastImage.attr('src', thumb_url);
            $lastImage.wrap('<a href="' + full_url + '" class="preview"></a>');
            $lastImage.parent().after('<div class="delete-link"><a href="' + id + 
                '"><img src="' + DELETE_ICON + '" />Remove</a></div>');

            Shadowbox.setup('a.preview');
        }

        function removeThumb(id, $frame) {
            console.log('Remove thumb ' + id);

            // TODO: Import or implement a form of Django url-reversing 
            // accessible to javascript, or insert variables at the top
            // of relevant templates.
            var rejectUrl = '/ps/api/image-reject/' + id;
            $.ajax(rejectUrl).done(function(data) {
                if(data.success) {
                    $('#sighting-photos').find('input[value=' + id + ']').remove();
                    $frame.fadeOut(300, function() { $frame.remove(); });
                } else {
                    console.log('Error removing sighting photo.');
                }
            });
        }

        function attachSightingPhoto(newPhotoId) {
            $('.template-photo').clone().removeClass('template-photo').attr({
                    'name': 'sightings_photos',
                    'value': newPhotoId
                }).appendTo('#sighting-photos');
        }

        function startUpload() {
            // Add the spinner to the gallery
            $('.thumb-gallery p').before('<div class="thumb-frame"><img class="thumb" src="' + 
                UPLOAD_SPINNER + '"></div>');
        }

        function photoUploaded(imageInfo) {
            console.log('Successfully uploaded sighting photo.');
            console.log('New Photo [id=' + imageInfo.id + ', thumb=' +
                        imageInfo.thumb + ', url=' + imageInfo.url + ']');
            addNewThumb(imageInfo.thumb, imageInfo.url, imageInfo.id);
            attachSightingPhoto(imageInfo.id);
        }

        function uploadError(errorInfo) {
            console.log('Error: ' + errorInfo);
        }

        $('.delete-link a').live('click', function() {
            $this = $(this);
            console.log('Delete image');
            $frame = $('.thumb-gallery .thumb-frame').has($this);
            removeThumb($this.attr('href'), $frame);

            return false;
        });

        upload_modal.setup('.image-modal', '#upload-link', {
            onStartUpload: startUpload,
            onUploadComplete: photoUploaded,
            onError: uploadError,
        });
    });


    $(window).load(function () {   // geocoder must be created at onload

        var geocoder = new Geocoder();
        var lat_long_regex = new RegExp(
            '(^(-?(\\d{1,3}.?\\d{1,6}? ?[nNsS]?))([, ]+)' +
            '(-?(\\d{1,3}.?\\d{1,6}? ?[wWeE]?))$)');

        // When the user enters a location, geocode it unless it already
        // looks like a pair of coordinates.
        $('#id_location').blur(function () {
            var location = $(this).val();

            var latitude, longitude = '';
            if (lat_long_regex.test(location)) {
                // TODO: handle more advanced lat/long formats (this
                // currently only handles floats)
                var coordinates = location.replace(' ', '').split(',');
                latitude = coordinates[0];
                longitude = coordinates[1];
                $('#id_latitude').val(latitude);
                $('#id_longitude').val(longitude);
            }
            else {
                geocoder.geocode(location, function (results, status) {
                    var lat_lng = geocoder.handle_response(results, status);
                    latitude = lat_lng.lat();
                    longitude = lat_lng.lng();
                    $('#id_latitude').val(latitude);
                    $('#id_longitude').val(longitude);
                });
            }
        });

    });

});

