-- The venues on the events page on 1 October 2026, with every Meetup venue id seen for each (plan §4).
-- Names and addresses are tidied from Meetup's; a new Meetup venue id is added as an alias in a later migration.
INSERT INTO `venues` (`id`, `name`, `address`, `city`) VALUES
	('lab111', 'LAB111', 'Arie Biemondstraat 111', 'Amsterdam'),
	('filmhallen', 'FilmHallen', 'Hannie Dankbaarpassage 12', 'Amsterdam'),
	('de-uitkijk', 'De Uitkijk', 'Prinsengracht 452', 'Amsterdam'),
	('eye', 'Eye Filmmuseum', 'IJpromenade 1', 'Amsterdam'),
	('pathe-tuschinski', 'Pathé Tuschinski', 'Reguliersbreestraat 26-34', 'Amsterdam'),
	('the-pulse', 'Cinema The Pulse', 'Hildegard von Bingenstraat 4', 'Amsterdam'),
	('tivolivredenburg', 'TivoliVredenburg', 'Vredenburgkade 11', 'Utrecht'),
	('kinepolis-brussels', 'Kinepolis Brussels', 'Boulevard du Centenaire 20', 'Brussels');
--> statement-breakpoint
INSERT INTO `venue_aliases` (`meetup_venue_id`, `venue_id`) VALUES
	('28353671', 'lab111'),
	('28339461', 'lab111'),
	('27337129', 'lab111'),
	('24839188', 'filmhallen'),
	('23871261', 'filmhallen'),
	('28339483', 'de-uitkijk'),
	('28320614', 'de-uitkijk'),
	('28327320', 'eye'),
	('28320468', 'pathe-tuschinski'),
	('28344836', 'the-pulse'),
	('27940035', 'tivolivredenburg'),
	('28300193', 'kinepolis-brussels');
