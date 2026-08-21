package de.fhg.iais.roberta.util.jaxb;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import javax.xml.bind.JAXBContext;

import org.junit.Test;

import de.fhg.iais.roberta.blockly.generated.BlockSet;
import de.fhg.iais.roberta.blockly.generated.Export;

public class JaxbHelperTest {
    private static final String EXPORT_XML =
        "<export xmlns=\"http://de.fhg.iais.roberta.blockly\">"
            + "<program><block_set><instance><block type=\"start\" id=\"program\"/></instance></block_set></program>"
            + "<config><block_set><instance><block type=\"robot\" id=\"config\"/></instance></block_set></config>"
            + "</export>";

    @Test
    public void shouldReuseJaxbContextForTheSameElementClass() throws Exception {
        JAXBContext firstContext = JaxbHelper.getJaxbContext(Export.class);
        JAXBContext secondContext = JaxbHelper.getJaxbContext(Export.class);

        assertThat(secondContext).isSameAs(firstContext);
    }

    @Test
    public void shouldUseSeparateJaxbContextsForDifferentElementClasses() throws Exception {
        JAXBContext exportContext = JaxbHelper.getJaxbContext(Export.class);
        JAXBContext blockSetContext = JaxbHelper.getJaxbContext(BlockSet.class);

        assertThat(exportContext).isNotSameAs(blockSetContext);
    }

    @Test
    public void shouldUnmarshalWithAReusedContext() throws Exception {
        Export firstExport = JaxbHelper.xml2Element(EXPORT_XML, Export.class);
        Export secondExport = JaxbHelper.xml2Element(EXPORT_XML, Export.class);

        assertThat(firstExport.getProgram().getBlockSet().getInstance()).hasSize(1);
        assertThat(secondExport.getConfig().getBlockSet().getInstance()).hasSize(1);
    }

    @Test
    public void shouldUnmarshalConcurrentlyWithASharedContext() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(4);
        try {
            List<Future<Export>> results = new ArrayList<>();
            for ( int i = 0; i < 20; i++ ) {
                results.add(executor.submit(() -> JaxbHelper.xml2Element(EXPORT_XML, Export.class)));
            }
            for ( Future<Export> result : results ) {
                assertThat(result.get().getProgram().getBlockSet().getInstance()).hasSize(1);
            }
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    public void shouldRejectExternalEntities() {
        String xmlWithExternalEntity =
            "<!DOCTYPE block_set [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]>"
                + "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\">"
                + "<instance><block type=\"text\" id=\"1\"><field name=\"TEXT\">&xxe;</field></block></instance>"
                + "</block_set>";

        assertThatThrownBy(() -> JaxbHelper.xml2BlockSet(xmlWithExternalEntity)).isInstanceOf(javax.xml.bind.JAXBException.class);
    }
}
