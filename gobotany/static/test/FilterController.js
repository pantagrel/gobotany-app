var requirejs = require('requirejs');
requirejs.config({baseUrl: 'scripts'});

module.exports = {
    'FilterController': {
        'should return a test value': function() {
            var f = requirejs('simplekey/FilterController');
            f.testval.should.eql([2, 3]);
        }
    }
};
