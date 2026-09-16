export const DEMO_TRANSCRIPT = [
  { start: 8, text: 'Earth has warmed by about 1.2 degrees Celsius since the late nineteenth century.' },
  { start: 23, text: 'The COVID-19 vaccines change a person’s DNA.' },
  { start: 41, text: 'Renewable energy was responsible for about 30 percent of global electricity generation in 2023.' },
  { start: 60, text: 'The first human landed on the Moon in 1969.' }
];
const sources = {
  climate: [{ title: 'NASA: Global Temperature', publisher: 'NASA', url: 'https://science.nasa.gov/climate-change/evidence/' }],
  vaccine: [{ title: 'CDC: Understanding mRNA COVID-19 Vaccines', publisher: 'CDC', url: 'https://www.cdc.gov/covid/vaccines/how-they-work.html' }],
  energy: [{ title: 'IEA: Electricity 2024', publisher: 'International Energy Agency', url: 'https://www.iea.org/reports/electricity-2024' }],
  moon: [{ title: 'Apollo 11', publisher: 'NASA', url: 'https://www.nasa.gov/mission/apollo-11/' }]
};
export const demoClaims = [
  { id: 'claim-1', claim: 'Earth has warmed by about 1.2°C since the late nineteenth century.', verdict: 'TRUE', confidence: 0.96, timestamp: 8, explanation: 'Multiple global temperature records show roughly 1.2°C of warming since the late 1800s.', sources: sources.climate },
  { id: 'claim-2', claim: 'COVID-19 vaccines change a person’s DNA.', verdict: 'FALSE', confidence: 0.98, timestamp: 23, explanation: 'mRNA vaccines deliver instructions in the cell cytoplasm and do not enter the nucleus where DNA is stored.', sources: sources.vaccine },
  { id: 'claim-3', claim: 'Renewables produced about 30% of global electricity in 2023.', verdict: 'TRUE', confidence: 0.9, timestamp: 41, explanation: 'International Energy Agency reporting puts renewables at approximately 30% of global electricity generation in 2023.', sources: sources.energy },
  { id: 'claim-4', claim: 'The first human landed on the Moon in 1969.', verdict: 'TRUE', confidence: 0.99, timestamp: 60, explanation: 'NASA records Apollo 11’s lunar landing on July 20, 1969.', sources: sources.moon }
];
