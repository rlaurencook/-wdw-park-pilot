# WDW Park Pilot — PWA

This is the installable web-app version of Park Pilot. It is designed for iPhone Safari and uses:

- ThemeParks.wiki live park data for operating status, standby waits, and return-time data when exposed.
- iPhone browser geolocation for your current position.
- A dynamic next-ride score plus a 4-stop look-ahead touring optimizer.
- Manual entry of your own Multi Pass and Single Pass reservations, because Disney does not provide a public API for a guest's personal My Disney Experience bookings.
- An in-app live map for your position/destination plus a one-tap handoff to Apple Maps for real pedestrian turn-by-turn directions.

## Important: the app must be hosted

An installable PWA cannot run correctly from an `index.html` file opened from the iPhone Files app. It must be served over HTTPS.

### Phone-only deployment

Any static-site host that accepts this folder will work. Upload the contents of this folder (not just index.html) to a static host such as GitHub Pages, Cloudflare Pages, Netlify, or another HTTPS host.

Once you have the HTTPS URL:

1. Open it in **Safari** on iPhone.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.
4. Turn on **Open as Web App** if iOS presents that option.
5. Launch **Park Pilot** from the new Home Screen icon.
6. Allow **Location While Using** when prompted.

## In-park workflow

1. Select your park.
2. Tap **Use my location**.
3. Enter the Lightning Lanes you currently hold.
4. The large card answers **where should I go next?**
5. Tap **Walking directions** for Apple Maps pedestrian navigation.
6. When you finish a ride, tap **Mark ridden**. The app immediately recalculates.
7. Add your next Lightning Lane after booking it in My Disney Experience; Park Pilot will incorporate the new window into the route.

## Routing note

The embedded map updates your blue-dot position and destination as you move. The optimizer estimates walking time from attraction coordinates and park-path adjustment. For true turn-by-turn walking routes, Park Pilot hands the destination to Apple Maps, which is more reliable than trying to recreate Disney pedestrian paths inside a keyless web app.

## Live data / attribution

Live park data is supplied by ThemeParks.wiki. This project displays attribution in the app footer. Availability of specific Lightning Lane return-time fields depends on what the upstream feed exposes.

Park Pilot is independent and is not affiliated with or endorsed by The Walt Disney Company.
