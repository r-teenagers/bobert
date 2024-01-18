export const formattedPointsString = (points: number): string => {
	if (points <= 0) return "Points :(";
	if (points === 1) return "Point";

	return "Points";
};

export function titleCaseOf(name: string): string {
	return name.replace(/\w\S*/g, (txt) => {
		return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
	});
}
