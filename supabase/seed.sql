-- =============================================================================
-- DEMO SEED DATA — FOR LOCAL DEVELOPMENT AND STAGING ONLY.
--
-- Every price, distance, duration and fleet record below is ILLUSTRATIVE.
-- Before launch, the business owner must replace them with verified figures
-- (see README → "Pre-launch checklist"). No reviews, bookings or payments are
-- seeded: testimonials must come from genuine customers only.
-- =============================================================================

-- Rate card (demo). Paise: 1 INR = 100.
insert into public.vehicle_rates (vehicle_class, label, example_models, seats, luggage_bags, base_fare_paise, per_km_paise, min_km_per_day, driver_allowance_per_day_paise, sort_order) values
  ('sedan',           'Sedan (4 seats)',            'Swift Dzire, Toyota Etios',  4,  2,  30000, 1300, 250, 40000, 1),
  ('suv',             'SUV (6 seats)',              'Maruti Ertiga',              6,  3,  40000, 1600, 250, 50000, 2),
  ('muv',             'Premium MUV (7 seats)',      'Toyota Innova Crysta',       7,  4,  50000, 1900, 250, 50000, 3),
  ('tempo_traveller', 'Tempo Traveller (12 seats)', 'Force Tempo Traveller',     12,  8,  80000, 2600, 250, 60000, 4),
  ('mini_bus',        'Mini Bus (20 seats)',        'Force Traveller 20-seater', 20, 15, 120000, 3600, 300, 70000, 5);

-- Demo fleet — replace with your real vehicles.
insert into public.vehicles (registration_number, vehicle_class, model, seats, notes) values
  ('DEMO-SEDAN-01', 'sedan', 'Swift Dzire (demo)', 4, 'DEMO DATA'),
  ('DEMO-SEDAN-02', 'sedan', 'Toyota Etios (demo)', 4, 'DEMO DATA'),
  ('DEMO-SUV-01', 'suv', 'Maruti Ertiga (demo)', 6, 'DEMO DATA'),
  ('DEMO-MUV-01', 'muv', 'Innova Crysta (demo)', 7, 'DEMO DATA'),
  ('DEMO-MUV-02', 'muv', 'Innova Crysta (demo)', 7, 'DEMO DATA'),
  ('DEMO-TT-01', 'tempo_traveller', 'Tempo Traveller (demo)', 12, 'DEMO DATA');

insert into public.drivers (full_name, phone, license_number, languages) values
  ('Demo Driver One', '+910000000001', 'DEMO-DL-0001', '{Telugu,Tamil,English}'),
  ('Demo Driver Two', '+910000000002', 'DEMO-DL-0002', '{Telugu,Hindi}'),
  ('Demo Driver Three', '+910000000003', 'DEMO-DL-0003', '{Telugu,Kannada}');

-- Destinations (descriptions are original; distances approximate — verify).
insert into public.destinations (slug, name, category, short_description, description, image_url, image_alt, latitude, longitude, distance_from_tirupati_km, best_time_to_visit, visitor_note, is_published, sort_order) values
  ('tirumala-sri-venkateswara-temple', 'Tirumala — Sri Venkateswara Swamy Temple', 'temple',
   'The hill shrine of Lord Venkateswara atop the Seshachalam ranges, reached by the ghat road from Tirupati.',
   E'Tirumala sits on the seventh peak of the Seshachalam hills and is among the most visited pilgrimage centres in the world. Vehicles reach the hill town by the up and down ghat roads, which are regulated by the temple administration and may have timing and vehicle restrictions.\n\nYatra Travel provides transport only. Darshan tickets, accommodation and sevas are issued exclusively by Tirumala Tirupati Devasthanams (TTD) through its official channels — please book them directly with TTD.',
   '/images/placeholders/temple-hills.svg', 'Illustration of a temple gopuram among green hills',
   13.683300, 79.347200, 22, 'September to February for cooler weather; expect larger crowds on weekends and festival days.',
   'Ghat road timings, dress code and security rules are set by TTD and may change. Please check official TTD announcements before travelling.',
   true, 1),
  ('sri-padmavathi-ammavari-temple-tiruchanur', 'Sri Padmavathi Ammavari Temple, Tiruchanur', 'temple',
   'Temple of Goddess Padmavathi, consort of Lord Venkateswara, a few kilometres from Tirupati town.',
   E'Many pilgrims visit Tiruchanur before or after their Tirumala visit. The temple is close to Tirupati town, so it fits easily into a half-day local temple tour.',
   '/images/placeholders/temple-pond.svg', 'Illustration of a temple tank with a small shrine',
   13.607600, 79.452500, 5, 'All year; early mornings are calmer.', 'Timings may vary on festival days.', true, 2),
  ('srikalahasti-temple', 'Srikalahasti Temple', 'temple',
   'Ancient Shiva temple on the banks of the Swarnamukhi river, famed for Rahu–Ketu pujas.',
   E'Srikalahasti is one of the Pancha Bhoota Sthalams, representing the element of air (Vayu). It combines well with Tirupati in a one-day temple circuit.',
   '/images/placeholders/temple-river.svg', 'Illustration of a temple tower beside a river',
   13.749600, 79.698700, 36, 'October to March.', 'Puja timings and ticketing are managed by the temple administration.', true, 3),
  ('kanipakam-vinayaka-temple', 'Sri Varasiddhi Vinayaka Temple, Kanipakam', 'temple',
   'Revered Ganesha temple in Chittoor district, often combined with a Tirupati trip.',
   E'Kanipakam is known for its self-manifested (swayambhu) idol of Lord Vinayaka. The drive from Tirupati passes through the countryside of Chittoor district.',
   '/images/placeholders/temple-village.svg', 'Illustration of a village temple with palm trees',
   13.276800, 78.993600, 70, 'All year.', null, true, 4),
  ('sri-govindaraja-swamy-temple', 'Sri Govindaraja Swamy Temple', 'temple',
   'Landmark temple in the heart of Tirupati town with a towering gopuram.',
   E'Located near the railway station, this temple is an easy stop on any local temple tour of Tirupati.',
   '/images/placeholders/temple-town.svg', 'Illustration of a tall temple gopuram in a town',
   13.628800, 79.419900, 1, 'All year.', null, true, 5),
  ('kapila-theertham', 'Kapila Theertham', 'temple',
   'Shiva temple and waterfall at the foot of the Tirumala hills.',
   E'Kapila Theertham is the only Shiva temple in Tirupati town. During the monsoon the waterfall beside the temple is at its fullest.',
   '/images/placeholders/waterfall.svg', 'Illustration of a waterfall beside a temple',
   13.651800, 79.418200, 4, 'July to December for the waterfall.', null, true, 6),
  ('talakona-waterfalls', 'Talakona Waterfalls', 'nature',
   'Tall waterfall inside Sri Venkateswara National Park, surrounded by forest.',
   E'Talakona is a popular day trip for nature lovers. Forest department rules on entry, timings and fees apply.',
   '/images/placeholders/forest.svg', 'Illustration of a forest waterfall',
   13.808000, 79.217000, 50, 'August to January.', 'Entry is regulated by the Forest Department and may close in adverse weather.', true, 7),
  ('chandragiri-fort', 'Chandragiri Fort', 'heritage',
   'Vijayanagara-era fort and Raja Mahal palace museum near Tirupati.',
   E'Chandragiri Fort offers a glimpse of the region''s history, with a palace museum and an evening light-and-sound show (subject to schedule).',
   '/images/placeholders/fort.svg', 'Illustration of a hill fort and palace',
   13.587000, 79.317000, 15, 'October to March.', 'Museum timings are set by the Archaeology department.', true, 8),
  ('sri-venkateswara-zoological-park', 'Sri Venkateswara Zoological Park', 'sightseeing',
   'One of the larger zoological parks in India, set in forested grounds near Tirupati.',
   E'A good half-day outing for families travelling with children.',
   '/images/placeholders/park.svg', 'Illustration of a zoo park entrance with trees',
   13.638000, 79.369000, 8, 'Mornings, October to March.', 'Typically closed one day a week; please check before visiting.', true, 9),
  ('sripuram-golden-temple-vellore', 'Sripuram Golden Temple, Vellore', 'temple',
   'Gold-covered temple of Goddess Sri Lakshmi Narayani at Vellore, Tamil Nadu.',
   E'An interstate day trip from Tirupati. Interstate permits and tolls apply to the vehicle.',
   '/images/placeholders/temple-gold.svg', 'Illustration of a golden temple',
   12.873000, 79.088700, 120, 'October to March.', null, true, 10);

-- Cab routes (approximate distances — verify before launch).
insert into public.cab_routes (slug, origin, destination, distance_km, typical_duration_minutes, notes, sort_order) values
  ('tirupati-to-tirumala', 'Tirupati', 'Tirumala', 22, 60, 'Ghat road; TTD vehicle rules apply.', 1),
  ('tirupati-airport-to-tirupati', 'Tirupati Airport (Renigunta)', 'Tirupati', 15, 35, null, 2),
  ('tirupati-airport-to-tirumala', 'Tirupati Airport (Renigunta)', 'Tirumala', 38, 90, 'Ghat road; TTD vehicle rules apply.', 3),
  ('tirupati-railway-station-to-tirumala', 'Tirupati Railway Station', 'Tirumala', 23, 60, null, 4),
  ('tirupati-to-srikalahasti', 'Tirupati', 'Srikalahasti', 36, 60, null, 5),
  ('tirupati-to-kanipakam', 'Tirupati', 'Kanipakam', 70, 100, null, 6),
  ('tirupati-to-chennai-airport', 'Tirupati', 'Chennai Airport', 140, 210, 'Interstate permit and tolls extra.', 7),
  ('tirupati-to-bengaluru', 'Tirupati', 'Bengaluru', 250, 330, 'Interstate permit and tolls extra.', 8),
  ('tirupati-to-vellore-golden-temple', 'Tirupati', 'Sripuram Golden Temple, Vellore', 120, 180, 'Interstate permit and tolls extra.', 9);

-- Packages (demo prices per vehicle).
insert into public.packages (slug, title, category, summary, description, duration_days, duration_nights, min_passengers, max_passengers, inclusions, exclusions, highlights, itinerary, default_start_time, image_url, image_alt, is_published, is_featured, sort_order) values
  ('tirumala-hill-transfer-same-day', 'Tirumala Hill Transfer — Same Day Return', 'tirumala',
   'Comfortable AC transport from Tirupati to Tirumala and back on the same day, with waiting time for your darshan.',
   E'Ideal for pilgrims who already hold darshan tickets booked through the official TTD channels. Your driver picks you up from your hotel, railway station or airport in Tirupati, drives you up the ghat road, waits while you complete your darshan and brings you back down.',
   1, 0, 1, 20,
   '{"AC vehicle with experienced local driver","Pickup and drop within Tirupati city limits","Up to 12 hours of vehicle usage","Fuel and driver allowance"}',
   '{"Darshan, seva or accommodation tickets (book only via official TTD channels)","Ghat road / parking fees and tolls, if any","Meals"}',
   '{"Driver familiar with Tirumala ghat road rules","Flexible waiting time","Hotel, railway station and airport pickup"}',
   '[{"day":1,"title":"Tirupati → Tirumala → Tirupati","details":"Pickup in Tirupati, drive up the ghat road, wait during darshan, return to Tirupati."}]',
   '04:00', '/images/placeholders/temple-hills.svg', 'Illustration of a temple gopuram among green hills', true, true, 1),
  ('tirupati-local-temples-tour', 'Tirupati Local Temples Tour', 'temple_circuit',
   'A relaxed one-day tour of the important temples in and around Tirupati town.',
   E'Covers Sri Padmavathi Ammavari Temple at Tiruchanur, Sri Govindaraja Swamy Temple, Kapila Theertham and other local shrines, at a pace that suits families and senior citizens.',
   1, 0, 1, 20,
   '{"AC vehicle with driver","Up to 8 hours / 80 km","Fuel and driver allowance"}',
   '{"Temple entry or special darshan tickets","Parking fees","Meals"}',
   '{"Tiruchanur Padmavathi Temple","Govindaraja Swamy Temple","Kapila Theertham"}',
   '[{"day":1,"title":"Tirupati local temples","details":"Tiruchanur → Govindaraja Swamy Temple → Kapila Theertham → ISKCON Tirupati (optional) → drop."}]',
   '07:00', '/images/placeholders/temple-pond.svg', 'Illustration of a temple tank with a small shrine', true, true, 2),
  ('srikalahasti-kanipakam-temple-circuit', 'Srikalahasti & Kanipakam Temple Circuit', 'temple_circuit',
   'Visit the Vayu Lingam at Srikalahasti and Lord Vinayaka at Kanipakam in a single day from Tirupati.',
   E'A full-day drive covering two of the most important temples in Chittoor and Tirupati districts. Your driver plans the route to avoid peak-hour traffic where possible.',
   1, 0, 1, 20,
   '{"AC vehicle with driver","Up to 12 hours / 250 km","Fuel and driver allowance"}',
   '{"Puja, seva or darshan tickets","Tolls and parking","Meals"}',
   '{"Srikalahasti Temple","Kanipakam Vinayaka Temple","Return by evening"}',
   '[{"day":1,"title":"Tirupati → Srikalahasti → Kanipakam → Tirupati","details":"Early start, Srikalahasti temple visit, lunch break, Kanipakam temple visit, return to Tirupati."}]',
   '06:00', '/images/placeholders/temple-river.svg', 'Illustration of a temple tower beside a river', true, true, 3),
  ('tirupati-sightseeing-talakona', 'Tirupati Nature & Heritage Day Trip', 'sightseeing',
   'Chandragiri Fort, the zoological park and Talakona Waterfalls — a day away from the crowds.',
   E'A day for families and nature lovers combining history and the forests of the Seshachalam hills.',
   1, 0, 1, 20,
   '{"AC vehicle with driver","Up to 12 hours / 200 km","Fuel and driver allowance"}',
   '{"Entry tickets to fort, zoo and forest areas","Tolls and parking","Meals"}',
   '{"Chandragiri Fort & Raja Mahal","Sri Venkateswara Zoological Park","Talakona Waterfalls"}',
   '[{"day":1,"title":"Chandragiri, zoo and Talakona","details":"Morning at the zoo, Chandragiri Fort after lunch, evening at Talakona (subject to forest timings)."}]',
   '07:00', '/images/placeholders/forest.svg', 'Illustration of a forest waterfall', true, false, 4),
  ('two-day-tirupati-pilgrimage', '2-Day Tirupati Pilgrimage Package', 'multi_day',
   'Tirumala on day one and the local temples, Srikalahasti and Kanipakam on day two.',
   E'A complete pilgrimage itinerary with a dedicated vehicle and driver for two days. Accommodation and darshan tickets are not included; we can suggest options, but tickets must be booked through official TTD channels.',
   2, 1, 1, 20,
   '{"AC vehicle with driver for 2 days","Fuel and driver allowance","Night halt charges for driver"}',
   '{"Darshan, seva or accommodation tickets","Hotel stay","Tolls, parking and permits","Meals"}',
   '{"Tirumala transfer","Tiruchanur & local temples","Srikalahasti & Kanipakam"}',
   '[{"day":1,"title":"Tirumala","details":"Pickup, ghat road to Tirumala, waiting during darshan, return to Tirupati."},{"day":2,"title":"Temple circuit","details":"Tiruchanur, Srikalahasti and Kanipakam, then drop at hotel, railway station or airport."}]',
   '04:00', '/images/placeholders/temple-gold.svg', 'Illustration of a golden temple', true, true, 5);

insert into public.package_prices (package_id, vehicle_class, price_paise)
select p.id, v.vehicle_class, v.price
from public.packages p
join (values
  ('tirumala-hill-transfer-same-day', 'sedan'::public.vehicle_class, 220000),
  ('tirumala-hill-transfer-same-day', 'suv', 280000),
  ('tirumala-hill-transfer-same-day', 'muv', 340000),
  ('tirumala-hill-transfer-same-day', 'tempo_traveller', 520000),
  ('tirupati-local-temples-tour', 'sedan', 180000),
  ('tirupati-local-temples-tour', 'suv', 230000),
  ('tirupati-local-temples-tour', 'muv', 280000),
  ('tirupati-local-temples-tour', 'tempo_traveller', 450000),
  ('srikalahasti-kanipakam-temple-circuit', 'sedan', 380000),
  ('srikalahasti-kanipakam-temple-circuit', 'suv', 470000),
  ('srikalahasti-kanipakam-temple-circuit', 'muv', 560000),
  ('srikalahasti-kanipakam-temple-circuit', 'tempo_traveller', 820000),
  ('tirupati-sightseeing-talakona', 'sedan', 340000),
  ('tirupati-sightseeing-talakona', 'suv', 420000),
  ('tirupati-sightseeing-talakona', 'muv', 500000),
  ('two-day-tirupati-pilgrimage', 'sedan', 650000),
  ('two-day-tirupati-pilgrimage', 'suv', 800000),
  ('two-day-tirupati-pilgrimage', 'muv', 950000),
  ('two-day-tirupati-pilgrimage', 'tempo_traveller', 1450000)
) as v(slug, vehicle_class, price) on v.slug = p.slug;

insert into public.package_destinations (package_id, destination_id, position)
select p.id, d.id, v.pos
from (values
  ('tirumala-hill-transfer-same-day', 'tirumala-sri-venkateswara-temple', 1),
  ('tirupati-local-temples-tour', 'sri-padmavathi-ammavari-temple-tiruchanur', 1),
  ('tirupati-local-temples-tour', 'sri-govindaraja-swamy-temple', 2),
  ('tirupati-local-temples-tour', 'kapila-theertham', 3),
  ('srikalahasti-kanipakam-temple-circuit', 'srikalahasti-temple', 1),
  ('srikalahasti-kanipakam-temple-circuit', 'kanipakam-vinayaka-temple', 2),
  ('tirupati-sightseeing-talakona', 'chandragiri-fort', 1),
  ('tirupati-sightseeing-talakona', 'sri-venkateswara-zoological-park', 2),
  ('tirupati-sightseeing-talakona', 'talakona-waterfalls', 3),
  ('two-day-tirupati-pilgrimage', 'tirumala-sri-venkateswara-temple', 1),
  ('two-day-tirupati-pilgrimage', 'sri-padmavathi-ammavari-temple-tiruchanur', 2),
  ('two-day-tirupati-pilgrimage', 'srikalahasti-temple', 3),
  ('two-day-tirupati-pilgrimage', 'kanipakam-vinayaka-temple', 4)
) as v(pkg, dest, pos)
join public.packages p on p.slug = v.pkg
join public.destinations d on d.slug = v.dest;

insert into public.faqs (question, answer, category, sort_order) values
  ('Do you provide Tirumala darshan tickets?', 'No. Yatra Travel is a private transport and tour operator and is not affiliated with Tirumala Tirupati Devasthanams (TTD). Darshan, seva and accommodation tickets are issued only by TTD through its official website and counters. We provide vehicles, drivers and travel planning.', 'tirumala', 1),
  ('Can you take us up the ghat road to Tirumala?', 'Yes. Our drivers are familiar with the Tirumala ghat roads. Vehicle checks, timings and restrictions on the ghat roads are set by TTD and the police, and we follow them.', 'tirumala', 2),
  ('How is the fare calculated?', 'Package prices are fixed per vehicle for the itinerary shown. Point-to-point cab fares are calculated from the route distance and the vehicle''s per-kilometre rate. Round trips are charged for at least the minimum kilometres per day plus a daily driver allowance. Tolls, parking and interstate permits are extra unless stated. The full fare breakdown, including tax, is shown before you pay.', 'pricing', 3),
  ('How do I pay?', 'You can pay securely online through our payment gateway using UPI, cards, net banking or wallets. We never see or store your card details.', 'payments', 4),
  ('How long is my booking held before payment?', 'A new booking holds the vehicle for a short payment window shown at checkout. If payment is not completed in that time, the booking is released automatically.', 'payments', 5),
  ('How do I cancel and how much will be refunded?', 'You can cancel from your account dashboard before the trip starts. The refund amount depends on how far ahead of the trip you cancel, as described in our Cancellation & Refund Policy. Refunds go back to your original payment method.', 'cancellation', 6),
  ('Can I customise an itinerary?', 'Yes. Use the Custom Itinerary form to tell us your dates, group size and the places you want to visit. Our team will contact you with a personalised quote.', 'general', 7);

-- Site settings (contact details intentionally blank — configure in /admin/settings).
insert into public.site_settings (key, value, is_public) values
  ('brand', '{"name":"Yatra Travel","tagline":"Your Journey, Our Devotion.","legal_name":"","gstin":""}', true),
  ('contact', '{"phone":"","email":"","address":"Tirupati, Andhra Pradesh, India","hours":"","map_url":""}', true),
  ('social', '{"facebook":"","instagram":"","youtube":"","x":""}', true),
  ('whatsapp', '{"enabled":false,"number":"","default_message":"Namaste! I would like to enquire about a trip with Yatra Travel."}', true),
  ('booking', '{"hold_minutes":30,"min_lead_hours":6,"max_advance_days":180,"tax_rate_bps":500,"tax_label":"GST","prices_include_tax":false}', true),
  ('cancellation_policy', '{"tiers":[{"min_hours_before":72,"refund_bps":9000},{"min_hours_before":24,"refund_bps":5000},{"min_hours_before":0,"refund_bps":0}],"note":"DEMO POLICY — confirm with the business owner before launch."}', true),
  ('legal', '{"policy_version":"2026-10-draft","last_updated":"2026-10-21","grievance_officer_name":"","grievance_officer_email":""}', true);
