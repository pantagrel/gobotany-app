/*
 * Classes that create and maintain the working area.
 *
 * Upon instantiation, a working-area class draws the entire working area
 * for the filter that it has been given, and then un-hides the working
 * area.  Once up and running, it responds to three calls from outside
 * telling it that the outside world has changed.  It is also responsible
 * for handling every click and interaction inside the working area, and
 * for - when appropriate - forwarding the change in the filter state to
 * the outside world.
 *
 * Inputs:
 *
 * clear() - the user has pressed the "x" next to the filter's name in
 *     the sidebar summary, and the filter value should be moved back
 *     to "don't know" if that is not already the value.
 * set_species_vector(vector) - some other filter has changed or cleared,
 *     so the set of available species has changed; the counts next to
 *     each character value should be changed, or, for a length filter,
 *     the set of allowable input ranges.
 * dismiss() - the filter working area should be dismissed.
 *
 * Outputs:
 *
 * on_change(filter) - the working area invokes this callback whenever
 *     a user action has caused the filter value to be selected and set.
 * on_dismiss(filter) - called when the user dismisses the working area.
 */

dojo.provide('gobotany.sk.working_area');

dojo.require('dojo.NodeList-html');

/**
 * Return the correct working area class for a given filter.
 *
 * @param {Filter} filter The filter for which you want a working area.
 * @return {Class} The class that will manage this kind of working area.
 */
gobotany.sk.working_area.select_working_area = function(filter) {
    if (filter.value_type == 'TEXT')
        return gobotany.sk.working_area.Choice;
    else if (filter.is_length())
        return gobotany.sk.working_area.Length;
    else
        return gobotany.sk.working_area.Slider;
};

/*
 * The most basic working-area class, which the other versions of the class
 * inherit from and specialize, is the standard multiple-choice selection.
 */

dojo.declare('gobotany.sk.working_area.Choice', null, {

    div_map: null,  // maps choice value -> <input> element
    close_button_connection: null,  // connection from the close button to us

    constructor: function(div, filter, species_vector, glossarizer,
                          on_change, on_dismiss) {
        this.div = div;
        this.filter = filter;
        this.short_name = filter.short_name;
        this.glossarizer = glossarizer;
        this._draw_basics();
        this._draw_specifics();
        this.set_species_vector(species_vector);
        this.on_change = on_change;
        this.on_dismiss = on_dismiss;
    },

    /* Events that can be triggered from outside. */

    clear: function() {
        dojo.query('input', this.div_map['']).attr('checked', true);
    },

    dismiss: function() {
        dojo.disconnect(this.close_button_connection);
        dojo.disconnect(this.apply_button_connection);
        this.close_button_connection = null;
        this.apply_button_connection = null;
        dojo.query(this.div).style({display: 'none'});
        this.on_dismiss(this.filter);
    },

    /* Draw the working area. */

    _draw_basics: function() {
        var d = dojo.query(this.div);
        var f = this.filter;
        var p = function(s) {return s ? '<p>' + s + '</p>' : s}

        d.query('h4').html(f.friendly_name);
        d.query('.question').html(p(f.question));
        d.query('.hint').html(p(f.hint));
        //q('.actions').html('actions');
        d.style({display: 'block'});

        var close_button = d.query('.close')[0];
        this.close_button_connection = dojo.connect(
            close_button, 'onclick', dojo.hitch(this, 'dismiss'));
    },

    _draw_specifics: function() {
        var CHOICES_PER_ROW = 5;
        var checked = function(cond) {return cond ? ' checked' : ''};
        var f = this.filter;

        var values_q = dojo.query('div.working-area .values');
        values_q.empty().addClass('multiple').removeClass('numeric');

        // Apply a custom sort to the filter values.
        var values = gobotany.utils.clone(f.values);
        values.sort(_compare_filter_choices);

        var choices_div = dojo.create('div', {'class': 'choices'}, values_q[0]);
        var row_div = dojo.create('div', {'class': 'row'}, choices_div);

        // Create a Don't Know radio button item.
        this.div_map = {};
        var item_html = '<div><label><input name="char_name"' +
            checked(f.selected_value === null) +
            ' type="radio" value=""> ' + _format_value() + '</label></div>';
        this.div_map[''] = dojo.place(item_html, row_div);

        // Create radio button items for each character value.
        var choices_count = 1;

        for (i = 0; i < values.length; i++) {
            var v = values[i];

            var item_html = '<label><input name="char_name" type="radio"' +
                checked(f.selected_value === v.choice) +
                ' value="' + v.choice + '">';

            // Add a drawing image thumbnail if present.
            var image_path = v.image_url;
            var thumbnail_html = '';
            var image_id = '';

            if (image_path.length > 0) {
                image_id = this._get_image_id_from_path(image_path);
                thumbnail_html = '<img id="' + image_id +
                    '" src="' + image_path + '" alt="drawing ' +
                    'showing ' + v.friendly_text + '"><br>';
                item_html += thumbnail_html;
            }

            item_html += ' <span class="label">' + _format_value(v) +
                '</span> <span class="count">(n)</span>' +
                '</label>';

            // Start a new row, if necessary, to fit this choice.
            if (choices_count % CHOICES_PER_ROW === 0)
                var row_div = dojo.create(
                    'div', {'class': 'row'}, choices_div);

            choices_count += 1;

            var character_value_div = dojo.create(
                'div', {'innerHTML': item_html}, row_div);
            this.div_map[v.choice] = character_value_div;

            // Once the item is added, add a tooltip for the drawing.
            if (image_path.length > 0) {
                var image_html = '<img id="' + image_id + '" src="' +
                    image_path + '" alt="drawing showing ' +
                    v.friendly_text + '">';
                new dijit.Tooltip({
                    connectId: [image_id],
                    label: image_html, position: ['after', 'above']
                });
            }

            var label = dojo.query('span.label', character_value_div)[0];
            this.glossarizer.markup(label);
        }

        // Hook up the Apply button.
        var button = dojo.query('.apply-btn', this.div)[0];
        this.apply_button_connection = dojo.connect(
            button, 'onclick', dojo.hitch(this, '_apply_button_clicked'));
    },

    /* Get a value suitable for use as an image element id from the
       image filename found in the image path. */

    _get_image_id_from_path: function(image_path) {
        var last_slash_index = image_path.lastIndexOf('/');
        var dot_index = image_path.indexOf('.', last_slash_index);
        var image_id = image_path.substring(last_slash_index + 1, dot_index);
        return image_id;
    },

    /* Given the vector of species to which all other active filters
       narrow the current pile, compute how many species would remain
       if each possible filter value were applied. */

    set_species_vector: function(species_vector) {
        for (var i = 0; i < this.filter.values.length; i++) {
            var v = this.filter.values[i];
            var vector = gobotany.filters.intersect(species_vector, v.species);
            var count_span_q = dojo.query('.count', this.div_map[v.choice]);
            count_span_q.html('(' + vector.length + ')');
            var input_field_q = dojo.query('input', this.div_map[v.choice]);
            input_field_q.attr('disabled', vector.length === 0);
        }
    },

    /* When the apply button is pressed, we announce a value change. */

    _apply_button_clicked: function() {
        var value = dojo.query('input:checked', this.div).attr('value')[0];
        this.filter.selected_value = value || null;
        this.on_change(this.filter);
    }
});

/*
 * Next comes the slider, for integer numeric fields.
 */

dojo.declare('gobotany.sk.working_area.Slider', [
    gobotany.sk.working_area.Choice
], {

    slider_node: null,
    simple_slider: null,

    /* See the comments on the Choice class, above, to learn about when
       and how these methods are invoked. */

    clear: function() {
    },  // *shrug* - slider just stays there (or should Apply light back up?)

    dismiss: function() {
        this.simple_slider.destroy();
        dojo.query(this.slider_node).orphan();
        this.simple_slider = this.slider_node = null;
    },

    _draw_specifics: function() {
        // values_list?
        var filter = this.filter;
        var num_values = filter.max - filter.min + 1;
        var startvalue = Math.ceil(num_values / 2);
        if (filter.selected_value !== null)
            startvalue = filter.selected_value;

        var values_q = dojo.query('div.working-area .values');
        var values_div = values_q[0];
        dojo.place('<label>Select a number between<br>' +
                   filter.min + ' and ' +
                   filter.max + '</label>', values_div);
        this.slider_node = dojo.create('div', null, values_div);
        this.simple_slider = new dijit.form.HorizontalSlider({
            id: 'simple-slider',
            name: 'simple-slider',
            value: startvalue,
            minimum: filter.min,
            maximum: filter.max,
            discreteValues: num_values,
            intermediateChanges: true,
            showButtons: false,
            onChange: dojo.hitch(this, this.set_simple_slider_value),
            onMouseUp: dojo.hitch(this, this.set_simple_slider_value)
        }, this.slider_node);
        dojo.create('div', {
            'class': 'count',
            'innerHTML': startvalue
        }, this.simple_slider.containerNode);
        this.set_simple_slider_value();
    },

    set_species_vector: function(species_vector) {
    }
});

/*
 * Finally, the text box where users can enter lengths.
 */

dojo.declare('gobotany.sk.working_area.Length', [
    gobotany.sk.working_area.Choice
], {
    permitted_ranges: [],  // [{min: n, max: m}, ...] all measured in mm
    unit: 'mm',
    factor: 1.0,

    _draw_specifics: function() {
        var v = dojo.query('div.working-area .values');
        v.empty().addClass('numeric').removeClass('multiple').html(
            '<div class="permitted_ranges"></div>' +
            '<div class="current_length"></div>' +
            '<div class="choose_length">' +
            'Length: <input name="measure" type="text" value=""><br>' +
            '<label>' +
            '<input name="units" type="radio" value="mm" checked>mm' +
            '</label>' +
            '<label>' +
            '<input name="units" type="radio" value="cm">cm' +
            '</label>' +
            '<label>' +
            '<input name="units" type="radio" value="m">m' +
            '</label>' +
                '</div>'
        );
        v.query('[name="units"]').connect('onchange', this, '_unit_changed');
        v.query('[type="text"]').connect('onchange', this, '_measure_changed');
        v.query('[type="text"]').connect('onkeyup', this, '_measure_changed');
    },

    _unit_changed: function(event) {
        this.unit = event.target.value;
        this.factor = ({mm: 1.0, cm: 0.1, m: 0.001})[this.unit];
        this._redraw_permitted_ranges();
        this._measure_changed();
    },

    _measure_changed: function(event) {
        var text = dojo.query('[name="measure"]', this.div).attr('value')[0];
        var mm = parseFloat(text) * this.factor;
        var legal = false;
        for (var i = 0; i < this.permitted_ranges.length; i++) {
            var pr = this.permitted_ranges[i];
            if (pr.min <= mm && mm <= pr.max) {
                var legal = true;
                break;
            }
        }
        console.log('Are we happy with this input?', legal);
        // drat, cannot disable the apply button? must ask Sid about what
        // approach to take instead:
        // dojo.query('a.apply-btn', this.div).attr('disabled', ! legal);
    },

    _redraw_permitted_ranges: function() {
        var p = 'Please choose a measurement in the range ';
        for (var i = 0; i < this.permitted_ranges.length; i++) {
            var pr = this.permitted_ranges[i];
            if (i) p += ' or ';
            p += (pr.min * this.factor) + '–' +
                (pr.max * this.factor) + '&nbsp;' + this.unit;
        }
        dojo.query('.permitted_ranges', this.div).html(p);
    },

    set_species_vector: function(species_vector) {
        this.permitted_ranges = this.filter.allowed_ranges(species_vector);
        this._redraw_permitted_ranges();
    }
});

/*
 * Helper functions
 */

/* Generate a human-readable representation of a value.
 */
var _format_value = function(v) {
    return v === undefined ? "don't know" :
        v.friendly_text ? v.friendly_text :
        v.choice === 'NA' ? "doesn't apply" :
        v.choice ? v.choice : "don't know";
};

/* Order filter choices for display.
 */
var _compare_filter_choices = function(a, b) {

    var friendly_text_a = a.friendly_text.toLowerCase();
    var friendly_text_b = b.friendly_text.toLowerCase();
    var choice_a = a.choice.toLowerCase();
    var choice_b = b.choice.toLowerCase();

    // If both are a number or begin with one, sort numerically.

    var int_friendly_text_a = parseInt(friendly_text_a, 10);
    var int_friendly_text_b = parseInt(friendly_text_b, 10);
    if (!isNaN(int_friendly_text_a) && !isNaN(int_friendly_text_b)) {
        return int_friendly_text_a - int_friendly_text_b;
    }
    var int_choice_a = parseInt(choice_a, 10);
    var int_choice_b = parseInt(choice_b, 10);
    if (!isNaN(int_choice_a) && !isNaN(int_choice_b)) {
        return int_choice_a - int_choice_b;
    }

    // Otherwise, sort alphabetically.

    // Exception: always make Doesn't Apply (NA) last.
    if (choice_a === 'na') return 1;
    if (choice_b === 'na') return -1;

    // If friendly text is present, sort using it.
    if (friendly_text_a < friendly_text_b) return -1;
    if (friendly_text_a > friendly_text_b) return 1;

    // If there is no friendly text, sort using the choices instead.
    if (choice_a < choice_b) return -1;
    if (choice_a > choice_b) return 1;

    return 0; // default value (no sort)
};
