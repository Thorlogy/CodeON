package de.fhg.iais.roberta.visitor.validate;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import com.google.common.collect.ClassToInstanceMap;

import de.fhg.iais.roberta.bean.IProjectBean;
import de.fhg.iais.roberta.components.ConfigurationAst;
import de.fhg.iais.roberta.components.UsedActor;
import de.fhg.iais.roberta.components.UsedSensor;
import de.fhg.iais.roberta.syntax.Phrase;
import de.fhg.iais.roberta.syntax.action.display.ClearDisplayAction;
import de.fhg.iais.roberta.syntax.action.display.ShowTextAction;
import de.fhg.iais.roberta.syntax.action.motor.MotorOnAction;
import de.fhg.iais.roberta.syntax.action.motor.MotorSetPowerAction;
import de.fhg.iais.roberta.syntax.action.motor.MotorStopAction;
import de.fhg.iais.roberta.syntax.action.motor.differential.DriveAction;
import de.fhg.iais.roberta.syntax.action.motor.differential.MotorDriveStopAction;
import de.fhg.iais.roberta.syntax.action.motor.differential.TurnAction;
import de.fhg.iais.roberta.syntax.action.sound.PlayNoteAction;
import de.fhg.iais.roberta.syntax.action.sound.ToneAction;
import de.fhg.iais.roberta.syntax.configuration.ConfigurationComponent;
import de.fhg.iais.roberta.syntax.sensor.ExternalSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.EncoderReset;
import de.fhg.iais.roberta.syntax.sensor.generic.EncoderSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.LightSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.TimerReset;
import de.fhg.iais.roberta.syntax.sensor.generic.TimerSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.TouchSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.VoltageSensor;
import de.fhg.iais.roberta.syntax.actors.edison.ReceiveIRAction;
import de.fhg.iais.roberta.syntax.actors.edison.SendIRAction;
import de.fhg.iais.roberta.syntax.lang.expr.NumConst;
import de.fhg.iais.roberta.syntax.sensor.generic.TemperatureSensor;
import de.fhg.iais.roberta.util.syntax.SC;
import de.fhg.iais.roberta.visitor.IRcxVisitor;

public class RcxValidatorAndCollectorVisitor extends CommonNepoAndMotorValidatorAndCollectorVisitor implements IRcxVisitor<Void> {

    private static final Map<String, String> SENSOR_COMPONENT_TYPE_MAP = Collections.unmodifiableMap(new HashMap<String, String>() {{
        put("LIGHT_SENSING", SC.LIGHT);
        put("TOUCH_SENSING", SC.TOUCH);
        put("ENCODER_SENSING", SC.ENCODER);
        put("TEMPERATURE_SENSING", SC.TEMPERATURE);
    }});

    private final boolean isSim;

    public RcxValidatorAndCollectorVisitor(ConfigurationAst brickConfiguration, ClassToInstanceMap<IProjectBean.IBuilder> beanBuilders, boolean isSim) {
        super(brickConfiguration, beanBuilders);
        this.isSim = isSim;
    }

    @Override
    public Void visitClearDisplayAction(ClearDisplayAction clearDisplayAction) {
        return null;
    }

    @Override
    public Void visitEncoderSensor(EncoderSensor encoderSensor) {
        checkSensorPort(encoderSensor);
        usedHardwareBuilder.addUsedSensor(new UsedSensor(encoderSensor.getUserDefinedPort(), SC.ENCODER, encoderSensor.getMode()));
        return null;
    }

    @Override
    public Void visitEncoderReset(EncoderReset encoderReset) {
        checkSensorPort(encoderReset);
        usedHardwareBuilder.addUsedSensor(new UsedSensor(encoderReset.sensorPort, SC.ENCODER, SC.DEFAULT));
        return null;
    }

    @Override
    public Void visitMotorOnAction(MotorOnAction motorOnAction) {
        String userDefinedPort = motorOnAction.getUserDefinedPort();
        ConfigurationComponent motor = robotConfiguration.optConfigurationComponent(userDefinedPort);
        if ( motor == null ) {
            addErrorToPhrase(motorOnAction, "CONFIGURATION_ERROR_MOTOR_MISSING");
        } else {
            usedHardwareBuilder.addUsedActor(new UsedActor(userDefinedPort, motor.componentType));
        }
        if ( motorOnAction.param.getDuration() != null ) {
            addErrorToPhrase(motorOnAction, "MotorOn mit Dauer/Rotationen wird vom RCX nicht unterstuetzt");
        }
        return null;
    }

    @Override
    public Void visitMotorSetPowerAction(MotorSetPowerAction a) {
        ConfigurationComponent motor = robotConfiguration.optConfigurationComponent(a.getUserDefinedPort());
        if ( motor == null ) {
            addErrorToPhrase(a, "CONFIGURATION_ERROR_MOTOR_MISSING");
        } else {
            usedHardwareBuilder.addUsedActor(new UsedActor(a.getUserDefinedPort(), motor.componentType));
        }
        return null;
    }

    @Override
    public Void visitMotorStopAction(MotorStopAction a) {
        ConfigurationComponent motor = robotConfiguration.optConfigurationComponent(a.getUserDefinedPort());
        if ( motor == null ) {
            addErrorToPhrase(a, "CONFIGURATION_ERROR_MOTOR_MISSING");
        } else {
            usedHardwareBuilder.addUsedActor(new UsedActor(a.getUserDefinedPort(), motor.componentType));
        }
        return null;
    }

    @Override
    public Void visitLightSensor(LightSensor lightSensor) {
        checkSensorPort(lightSensor);
        usedHardwareBuilder.addUsedSensor(new UsedSensor(lightSensor.getUserDefinedPort(), SC.LIGHT, lightSensor.getMode()));
        return null;
    }

    @Override
    public Void visitPlayNoteAction(PlayNoteAction playNoteAction) {
        usedHardwareBuilder.addUsedActor(new UsedActor("", SC.SOUND));
        return null;
    }

    @Override
    public Void visitShowTextAction(ShowTextAction showTextAction) {
        requiredComponentVisited(showTextAction, showTextAction.msg, showTextAction.x, showTextAction.y);
        return null;
    }

    @Override
    public Void visitTimerSensor(TimerSensor timerSensor) {
        usedHardwareBuilder.addUsedSensor(new UsedSensor(timerSensor.getUserDefinedPort(), SC.TIMER, timerSensor.getMode()));
        return null;
    }

    @Override
    public Void visitVoltageSensor(VoltageSensor voltageSensor) {
        usedHardwareBuilder.addUsedSensor(new UsedSensor(voltageSensor.getUserDefinedPort(), SC.VOLTAGE, voltageSensor.getMode()));
        addToPhraseIfUnsupportedInSim(voltageSensor, true, this.isSim);
        return null;
    }

    @Override
    public Void visitTimerReset(TimerReset timerReset) {
        usedHardwareBuilder.addUsedSensor(new UsedSensor(timerReset.sensorPort, SC.TIMER, SC.DEFAULT));
        return null;
    }

    @Override
    public Void visitSendIRAction(SendIRAction sendIRAction) {
        requiredComponentVisited(sendIRAction, sendIRAction.code);
        if ( sendIRAction.code instanceof NumConst ) {
            try {
                double value = Double.parseDouble(((NumConst) sendIRAction.code).value);
                if ( value < 1 || value > 255 ) {
                    addErrorToPhrase(sendIRAction, "IR-Nachricht muss zwischen 1 und 255 liegen");
                }
            } catch ( NumberFormatException e ) {
                // nicht auswertbar -> zur Laufzeit pruefen lassen
            }
        }
        addToPhraseIfUnsupportedInSim(sendIRAction, false, this.isSim);
        return null;
    }

    @Override
    public Void visitReceiveIRAction(ReceiveIRAction receiveIRAction) {
        addToPhraseIfUnsupportedInSim(receiveIRAction, true, this.isSim);
        return null;
    }

    @Override
    public Void visitToneAction(ToneAction toneAction) {
        requiredComponentVisited(toneAction, toneAction.duration, toneAction.frequency);
        return null;
    }

    @Override
    public Void visitTouchSensor(TouchSensor touchSensor) {
        checkSensorPort(touchSensor);
        usedHardwareBuilder.addUsedSensor(new UsedSensor(touchSensor.getUserDefinedPort(), SC.TOUCH, touchSensor.getMode()));
        return null;
    }

    @Override
    public Void visitTemperatureSensor(TemperatureSensor temperatureSensor) {
        checkSensorPort(temperatureSensor);
        usedHardwareBuilder.addUsedSensor(new UsedSensor(temperatureSensor.getUserDefinedPort(), SC.TEMPERATURE, temperatureSensor.getMode()));
        return null;
    }

    @Override
    public Void visitTurnAction(TurnAction turnAction) {
        checkAndVisitMotionParam(turnAction, turnAction.param);
        checkLeftRightMotorPort(turnAction);
        addLeftAndRightMotorToUsedActors();
        return null;
    }

    @Override
    public Void visitDriveAction(DriveAction driveAction) {
        checkAndVisitMotionParam(driveAction, driveAction.param);
        checkLeftRightMotorPort(driveAction);
        addLeftAndRightMotorToUsedActors();
        return null;
    }

    @Override
    public Void visitMotorDriveStopAction(MotorDriveStopAction stopAction) {
        checkLeftRightMotorPort(stopAction);
        addLeftAndRightMotorToUsedActors();
        return null;
    }

    private void checkLeftRightMotorPort(Phrase driveAction) {
        if ( hasTooManyMotors(driveAction) ) {
            return;
        }
        ConfigurationComponent leftMotor = this.robotConfiguration.getFirstMotor(SC.LEFT);
        ConfigurationComponent rightMotor = this.robotConfiguration.getFirstMotor(SC.RIGHT);
        if ( leftMotor == null ) {
            addErrorToPhrase(driveAction, "CONFIGURATION_ERROR_MOTOR_LEFT_MISSING");
        }
        if ( rightMotor == null ) {
            addErrorToPhrase(driveAction, "CONFIGURATION_ERROR_MOTOR_RIGHT_MISSING");
        }
    }

    protected boolean hasTooManyMotors(Phrase driveAction) {
        if ( this.robotConfiguration.getMotors(SC.RIGHT).size() > 1 ) {
            addErrorToPhrase(driveAction, "CONFIGURATION_ERROR_MULTIPLE_RIGHT_MOTORS");
            return true;
        }
        if ( this.robotConfiguration.getMotors(SC.LEFT).size() > 1 ) {
            addErrorToPhrase(driveAction, "CONFIGURATION_ERROR_MULTIPLE_LEFT_MOTORS");
            return true;
        }
        return false;
    }

    private void addLeftAndRightMotorToUsedActors() {
        Optional<String> optionalLeftPort = Optional.ofNullable(robotConfiguration.getFirstMotor(SC.LEFT))
            .map(cc -> cc.userDefinedPortName);
        Optional<String> optionalRightPort = Optional.ofNullable(robotConfiguration.getFirstMotor(SC.RIGHT))
            .map(cc -> cc.userDefinedPortName);
        if ( optionalLeftPort.isPresent() && optionalRightPort.isPresent() ) {
            usedHardwareBuilder.addUsedActor(new UsedActor(optionalLeftPort.get(), SC.LARGE));
            usedHardwareBuilder.addUsedActor(new UsedActor(optionalRightPort.get(), SC.LARGE));
        }
    }

    private void checkSensorPort(ExternalSensor sensor) {
        ConfigurationComponent configurationComponent = robotConfiguration.optConfigurationComponent(sensor.getUserDefinedPort());
        if ( configurationComponent == null ) {
            addErrorToPhrase(sensor, "CONFIGURATION_ERROR_SENSOR_MISSING");
            return;
        }
        String expectedComponentType = SENSOR_COMPONENT_TYPE_MAP.get(sensor.getKind().getName());
        if ( expectedComponentType != null && !expectedComponentType.equalsIgnoreCase(configurationComponent.componentType) ) {
            addErrorToPhrase(sensor, "CONFIGURATION_ERROR_SENSOR_WRONG");
        }
    }

    private void checkSensorPort(EncoderReset sensor) {
        ConfigurationComponent configurationComponent = robotConfiguration.optConfigurationComponent(sensor.sensorPort);
        if ( configurationComponent == null ) {
            addErrorToPhrase(sensor, "CONFIGURATION_ERROR_SENSOR_MISSING");
            return;
        }
        if ( !SC.ENCODER.equalsIgnoreCase(configurationComponent.componentType) ) {
            addErrorToPhrase(sensor, "CONFIGURATION_ERROR_SENSOR_WRONG");
        }
    }
}
