from gobotany import models
from gobotany.botany_plugins.models import TaxonImage


class SpeciesReader(object):

    def query_species(self,
                      scientific_name=None,
                      **kwargs):
        if scientific_name is not None:
            return models.Taxon.objects.filter(scientific_name__iexact=scientific_name)
        else:
            base_query = models.Taxon.objects
            for k, v in kwargs.items():
                base_query = base_query.filter(
                    character_values__character__short_name=k,
                    character_values__value=v)
            return base_query

    def species_images(self, species, canonical_only=False,
                       image_types=None):
        query = {'canonical': canonical_only}
        if image_types:
            if isinstance(image_types, basestring):
                image_types = [s.strip() for s in image_types.split(',')]
            query['image_type__in'] = image_types
        # If we have a string assume it's the scientific name, otherwise
        # we have a taxon object or id
        if isinstance(species, basestring):
            query['taxon__scientific_name__iexact'] = species
        else:
            query['taxon'] = species
        return TaxonImage.objects.filter(**query)

_reader = SpeciesReader()
query_species = _reader.query_species
species_images = _reader.species_images
