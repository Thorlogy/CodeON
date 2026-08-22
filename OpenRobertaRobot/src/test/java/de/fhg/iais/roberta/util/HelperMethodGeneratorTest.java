package de.fhg.iais.roberta.util;

import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.HashSet;

import org.json.JSONObject;
import org.junit.Test;

import de.fhg.iais.roberta.util.HelperMethodGenerator.Language;
import de.fhg.iais.roberta.util.syntax.FunctionNames;

public class HelperMethodGeneratorTest {
    private static final String PYTHON_PRIME = "def _prime(number):\n    return number > 1";
    private static final String PYTHON_CUSTOM = "def _custom(value):\n    return value";
    private static final String PYTHON_SHARED = "def _shared(value):\n    return value";
    private static final String JAVA_CUSTOM = "private int _custom(int value) {\n    return value;\n}";

    private enum AdditionalMethods {
        CUSTOM,
        SHARED
    }

    private enum OtherAdditionalMethods {
        SHARED
    }

    @Test
    public void shouldGenerateDefinitionsInDeterministicOrder() {
        HelperMethodGenerator generator = new HelperMethodGenerator(helperMethods(), Language.PYTHON);
        generator.addAdditionalEnum(AdditionalMethods.class);

        String definitions =
            generator.getHelperMethodDefinitions(new HashSet<>(Arrays.asList(FunctionNames.PRIME, AdditionalMethods.CUSTOM)));

        assertEquals("\n" + PYTHON_CUSTOM + "\n" + PYTHON_PRIME, definitions);
    }

    @Test
    public void shouldGenerateLanguageSpecificDeclarationsWithoutChangingFormatting() {
        HelperMethodGenerator pythonGenerator = new HelperMethodGenerator(helperMethods(), Language.PYTHON);
        pythonGenerator.addAdditionalEnum(AdditionalMethods.class);
        assertEquals("\ndef _custom(value):", pythonGenerator.getHelperMethodDeclarations(new HashSet<>(Arrays.asList(AdditionalMethods.CUSTOM))));

        HelperMethodGenerator javaGenerator = new HelperMethodGenerator(helperMethods(), Language.JAVA);
        javaGenerator.addAdditionalEnum(AdditionalMethods.class);
        assertEquals("\nprivate int _custom(int value);", javaGenerator.getHelperMethodDeclarations(new HashSet<>(Arrays.asList(AdditionalMethods.CUSTOM))));
    }

    @Test
    public void shouldLoadSameNamedMethodsForIndependentEnums() {
        HelperMethodGenerator generator = new HelperMethodGenerator(helperMethods(), Language.PYTHON);
        generator.addAdditionalEnum(AdditionalMethods.class);
        generator.addAdditionalEnum(OtherAdditionalMethods.class);

        assertEquals("_shared", generator.getHelperMethodName(AdditionalMethods.SHARED));
        assertEquals("_shared", generator.getHelperMethodName(OtherAdditionalMethods.SHARED));
    }

    @Test
    public void shouldReloadPreviouslyRegisteredEnumsWhenConfigurationChanges() {
        JSONObject helperMethods = helperMethods();
        HelperMethodGenerator generator = new HelperMethodGenerator(helperMethods, Language.PYTHON);
        generator.addAdditionalEnum(AdditionalMethods.class);
        helperMethods.getJSONObject("CUSTOM").put("PYTHON", "def _updated(value):\n    return value");

        generator.addAdditionalEnum(OtherAdditionalMethods.class);

        assertEquals("_updated", generator.getHelperMethodName(AdditionalMethods.CUSTOM));
    }

    private static JSONObject helperMethods() {
        return new JSONObject()
            .put("PRIME", new JSONObject().put("PYTHON", PYTHON_PRIME))
            .put("CUSTOM", new JSONObject().put("PYTHON", PYTHON_CUSTOM).put("JAVA", JAVA_CUSTOM))
            .put("SHARED", new JSONObject().put("PYTHON", PYTHON_SHARED))
            .put("NOT_AN_ENUM_VALUE", new JSONObject().put("PYTHON", "def _unused():\n    pass"));
    }
}
