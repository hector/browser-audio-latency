export function draw(data, min = undefined) {
  const dataPoints = data.map((v) => ({ y: v }));
  if (min)
    dataPoints[min] = {
      y: data[min],
      indexLabel: "\u2193 lowest",
      markerColor: "DarkSlateGrey",
      markerType: "cross",
    };
  const chart = new CanvasJS.Chart("chartContainer", {
    animationEnabled: true,
    theme: "light2",
    title: {
      text: "Correlation",
    },
    axisY: {
      includeZero: false,
    },
    data: [
      {
        type: "line",
        indexLabelFontSize: 16,
        dataPoints,
      },
    ],
  });
  chart.render();
}
