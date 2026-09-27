export default async function silverpoloProductsRoutes(app) {
  app.get('/ticimax-urunler', async (req, reply) => {
    try {
        const xmlUrl = 'https://silverpolo.com/TicimaxXmlV2/280133B373364E089E0235C6FF49A2D2/';
        
        // Axios yerine Node.js'in yerel fetch fonksiyonunu kullanıyoruz
        const response = await fetch(xmlUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'text/xml'
            }
        });

        if (!response.ok) {
            throw new Error(`Ticimax sunucusu hata döndürdü: ${response.status}`);
        }

        // Gelen yanıtı metin (text) olarak alıyoruz
        const xmlMetni = await response.text();
        
        // React'e bunun bir XML verisi olduğunu söyleyerek gönderiyoruz
        reply.header('Content-Type', 'text/xml').send(xmlMetni);

    } catch (error) {
        app.log.error('XML çekilirken backend hatası:', error);
        reply.status(500).send({ error: 'XML verisi çekilemedi: ' + error.message });
    }
  });
}