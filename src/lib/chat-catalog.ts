// Destinos publicados. O modelo escolhe ações; não cria novos contatos ou vídeos.
export const CHAT_SECTION_IDS = new Set(["inicio", "sobre", "experiencia", "projetos", "formacao", "habilidades", "contato"]);
export const CHAT_URLS = new Set([
  "https://www.linkedin.com/in/guilhermeresende/",
  "mailto:guiresende20@gmail.com",
  "https://wa.me/5551997925092",
  "http://lattes.cnpq.br/5709726694301047",
  "https://lattes.cnpq.br/5709726694301047",
  "https://portobello-20260718.web.app/",
  "https://open.spotify.com/user/12153378045?si=e33f29c442a54f11",
  "https://github.com/guiresende20/project_gesture",
  "https://drive.google.com/file/d/1rpL0BNna9_d-OzknEKFjlttSoOtAZL5I/view?usp=sharing",
  "https://lume.ufrgs.br/browse?locale-attribute=es&type=author&value=Muniz%2C+Guilherme+Resende",
  ...["JV1fSU26OI8", "MfF3DtRcPt8", "PnA-OM2vmQ4", "D8rCRnvKOtg", "cnu7cPUpoUw", "-djac5g7_QE", "dbQSeUF8NOQ", "uyOTGKe0bGo"].map(id => `https://www.youtube.com/embed/${id}`),
]);

export const CHAT_ACTION_GUIDE = `Ações opcionais: no máximo três, com label curto.
video: url exata do vídeo publicado; link: url exata de projeto, contato ou post recebido;
whatsapp: https://wa.me/5551997925092; email: mailto:guiresende20@gmail.com;
scroll: section em inicio, sobre, experiencia, projetos, formacao, habilidades, contato;
download_cv: cv_type em ux, academic, innovation, full.
Vídeos: MuseuVR JV1fSU26OI8, reportagem MfF3DtRcPt8, Tecnopuc PnA-OM2vmQ4,
IASPI D8rCRnvKOtg, digitalização cnu7cPUpoUw, MataArte -djac5g7_QE,
Grafitti dbQSeUF8NOQ, Gesture Keys uyOTGKe0bGo. Use https://www.youtube.com/embed/ID.
App Portobello: https://portobello-20260718.web.app/.
Sem ação pertinente, actions vazio. Não invente destinos.`;
