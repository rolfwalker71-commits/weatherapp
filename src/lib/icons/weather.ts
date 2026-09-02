import Cloud from '@material-symbols/svg-400/rounded/cloud.svg?raw';
import Foggy from '@material-symbols/svg-400/rounded/foggy.svg?raw';
import Nightlight from '@material-symbols/svg-400/rounded/nightlight.svg?raw';
import PartlyCloudyDay from '@material-symbols/svg-400/rounded/partly_cloudy_day.svg?raw';
import PartlyCloudyNight from '@material-symbols/svg-400/rounded/partly_cloudy_night.svg?raw';
import Rainy from '@material-symbols/svg-400/rounded/rainy.svg?raw';
import RainyHeavy from '@material-symbols/svg-400/rounded/rainy_heavy.svg?raw';
import RainyLight from '@material-symbols/svg-400/rounded/rainy_light.svg?raw';
import Snowflake from '@material-symbols/svg-400/rounded/snowflake.svg?raw';
import Sunny from '@material-symbols/svg-400/rounded/sunny.svg?raw';
import Thunderstorm from '@material-symbols/svg-400/rounded/thunderstorm.svg?raw';
import WeatherHail from '@material-symbols/svg-400/rounded/weather_hail.svg?raw';
import WeatherSnowy from '@material-symbols/svg-400/rounded/weather_snowy.svg?raw';

export type WeatherGlyph =
	| 'sunny'
	| 'nightlight'
	| 'partly_cloudy_day'
	| 'partly_cloudy_night'
	| 'cloud'
	| 'foggy'
	| 'rainy_light'
	| 'rainy'
	| 'rainy_heavy'
	| 'weather_snowy'
	| 'snowflake'
	| 'thunderstorm'
	| 'weather_hail';

export const WEATHER_GLYPHS: Record<WeatherGlyph, string> = {
	sunny: Sunny,
	nightlight: Nightlight,
	partly_cloudy_day: PartlyCloudyDay,
	partly_cloudy_night: PartlyCloudyNight,
	cloud: Cloud,
	foggy: Foggy,
	rainy_light: RainyLight,
	rainy: Rainy,
	rainy_heavy: RainyHeavy,
	weather_snowy: WeatherSnowy,
	snowflake: Snowflake,
	thunderstorm: Thunderstorm,
	weather_hail: WeatherHail
};
