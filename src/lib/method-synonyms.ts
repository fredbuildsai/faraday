import { normaliseMethod } from "@/lib/matching";

/** Tidied method name -> canonical name. Keys must already be lowercase, single-spaced, no trailing "s". */
export const METHOD_SYNONYMS: Record<string, string> = {
  "ml": "machine learning", "machine-learning": "machine learning",
  "dl": "deep learning", "neural network": "deep learning", "deep neural network": "deep learning",
  "nlp": "natural language processing", "text mining": "natural language processing",
  "rct": "randomized controlled trial", "randomised controlled trial": "randomized controlled trial",
  "qualitative interview": "interview", "semi-structured interview": "interview",
  "survey research": "survey", "questionnaire": "survey",
  "regression analysi": "regression", "linear regression": "regression",
  "meta analysi": "meta-analysis", "metaanalysi": "meta-analysis",
  "systematic literature review": "systematic review",
  "gis": "geographic information system",
  "mri": "magnetic resonance imaging", "fmri": "functional mri",
  "pcr": "polymerase chain reaction", "qpcr": "quantitative pcr",
  "rna-seq": "rna sequencing", "rnaseq": "rna sequencing",
  "md simulation": "molecular dynamics", "molecular dynamics simulation": "molecular dynamics",
  "dft": "density functional theory",
  "fea": "finite element analysis", "finite element method": "finite element analysis", "fem": "finite element analysis",
  "cfd": "computational fluid dynamics",
  "sem": "structural equation modelling", "structural equation modeling": "structural equation modelling",
  "ethnographic fieldwork": "ethnography",
  "monte carlo simulation": "monte carlo", "bayesian statistic": "bayesian inference",
};

export const tidyMethod = (m: string) => normaliseMethod(m, METHOD_SYNONYMS);
