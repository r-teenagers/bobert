export const formattedPointsString = (points: number): string => {
	if (points <= 0) return "Points :(";
	if (points === 1) return "Point";

	return "Points";
}
