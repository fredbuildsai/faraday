// Test researchers. Every account created from this list is tagged with SEED_TAG so rollback.ts can find it.
export const SEED_TAG = "lattice-test-seed";
export const MAX_WORKS = 200; // most recent works only, to keep the AI analysis small

export const PEOPLE = [
  { email: "hubert.gasteiger@test.lattice-scout.example", first: "Hubert", last: "Gasteiger", inst: "Technical University of Munich", ids: ["A5088146443"] },
  { email: "jeff.dahn@test.lattice-scout.example", first: "Jeff", last: "Dahn", inst: "Dalhousie University", ids: ["A5011977904"] },
  { email: "brett.lucht@test.lattice-scout.example", first: "Brett", last: "Lucht", inst: "University of Rhode Island", ids: ["A5024990798"] },
];
