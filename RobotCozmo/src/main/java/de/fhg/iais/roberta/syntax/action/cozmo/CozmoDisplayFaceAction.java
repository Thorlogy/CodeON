package de.fhg.iais.roberta.syntax.action.cozmo;

import de.fhg.iais.roberta.syntax.action.Action;
import de.fhg.iais.roberta.transformer.forClass.NepoPhrase;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoPhrase(name = "COZMO_DISPLAY_FACE_ACTION", category = "ACTOR", blocklyNames = {"cozmoActions_displayFace"})
public final class CozmoDisplayFaceAction extends Action {
    @NepoField(name = "FACE")
    public final String face;

    public CozmoDisplayFaceAction(BlocklyProperties properties, String face) {
        super(properties);
        this.face = face;
        setReadOnly();
    }
}
