package de.fhg.iais.roberta.visitor;

import de.fhg.iais.roberta.syntax.action.display.ClearDisplayAction;
import de.fhg.iais.roberta.syntax.actors.edison.ReceiveIRAction;
import de.fhg.iais.roberta.syntax.actors.edison.SendIRAction;
import de.fhg.iais.roberta.syntax.action.display.ShowTextAction;
import de.fhg.iais.roberta.syntax.action.motor.MotorOnAction;
import de.fhg.iais.roberta.syntax.action.motor.MotorSetPowerAction;
import de.fhg.iais.roberta.syntax.action.motor.MotorStopAction;
import de.fhg.iais.roberta.syntax.action.motor.differential.DriveAction;
import de.fhg.iais.roberta.syntax.action.motor.differential.MotorDriveStopAction;
import de.fhg.iais.roberta.syntax.action.motor.differential.TurnAction;
import de.fhg.iais.roberta.syntax.action.sound.PlayNoteAction;
import de.fhg.iais.roberta.syntax.action.sound.ToneAction;
import de.fhg.iais.roberta.syntax.sensor.generic.EncoderReset;
import de.fhg.iais.roberta.syntax.sensor.generic.EncoderSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.LightSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.TimerReset;
import de.fhg.iais.roberta.syntax.sensor.generic.TimerSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.TouchSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.VoltageSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.TemperatureSensor;

public interface IRcxVisitor<V> extends IVisitor<V> {

    V visitClearDisplayAction(ClearDisplayAction clearDisplayAction);

    V visitEncoderSensor(EncoderSensor encoderSensor);

    V visitEncoderReset(EncoderReset encoderReset);

    V visitMotorOnAction(MotorOnAction motorOnAction);

    V visitMotorSetPowerAction(MotorSetPowerAction motorSetPowerAction);

    V visitMotorStopAction(MotorStopAction motorStopAction);

    V visitDriveAction(DriveAction driveAction);

    V visitTurnAction(TurnAction turnAction);

    V visitMotorDriveStopAction(MotorDriveStopAction stopAction);

    V visitLightSensor(LightSensor lightSensor);

    V visitPlayNoteAction(PlayNoteAction playNoteAction);

    V visitShowTextAction(ShowTextAction showTextAction);

    V visitTimerSensor(TimerSensor timerSensor);

    V visitTimerReset(TimerReset timerReset);

    V visitToneAction(ToneAction toneAction);

    V visitTouchSensor(TouchSensor touchSensor);

    V visitTemperatureSensor(TemperatureSensor temperatureSensor);

    V visitVoltageSensor(VoltageSensor voltageSensor);

    V visitSendIRAction(SendIRAction sendIRAction);

    V visitReceiveIRAction(ReceiveIRAction receiveIRAction);
}
