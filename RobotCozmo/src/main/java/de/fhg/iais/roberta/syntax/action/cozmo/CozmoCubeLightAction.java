package de.fhg.iais.roberta.syntax.action.cozmo;

import de.fhg.iais.roberta.syntax.action.Action;
import de.fhg.iais.roberta.transformer.forClass.NepoPhrase;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoPhrase(name = "COZMO_CUBE_LIGHT_ACTION", category = "ACTOR", blocklyNames = {"cozmoActions_cubeLight"})
public final class CozmoCubeLightAction extends Action {
    @NepoField(name = "CUBE")
    public final String cube;
    @NepoField(name = "COLOR")
    public final String color;

    public CozmoCubeLightAction(BlocklyProperties properties, String cube, String color) {
        super(properties);
        this.cube = cube;
        this.color = color;
        setReadOnly();
    }
}
