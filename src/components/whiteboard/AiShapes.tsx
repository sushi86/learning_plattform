"use client";

import { Group, Rect, Text } from "react-konva";
import type { AiStepShape, AiCorrectionShape } from "@/lib/ai/types";

/* --- AiStepNode --- */

interface AiStepNodeProps {
  shape: AiStepShape;
  onClick?: () => void;
}

export function AiStepNode({ shape, onClick }: AiStepNodeProps) {
  const isFirst = shape.props.stepIndex === 0;

  return (
    <Group x={shape.x} y={shape.y} onClick={onClick}>
      {/* KI badge on first step */}
      {isFirst && (
        <>
          <Rect
            x={-4}
            y={-22}
            width={28}
            height={18}
            fill="#7c3aed"
            cornerRadius={9}
          />
          <Text
            x={-4}
            y={-22}
            width={28}
            height={18}
            text="KI"
            fontSize={11}
            fontStyle="bold"
            fill="#ffffff"
            align="center"
            verticalAlign="middle"
          />
        </>
      )}
      {/* Step text */}
      <Text
        x={0}
        y={0}
        text={shape.props.text}
        fontSize={24}
        fontFamily="Caveat, cursive"
        fill="#7c3aed"
        width={400}
      />
      {/* Explanation text below */}
      <Text
        x={0}
        y={30}
        text={shape.props.explanation}
        fontSize={16}
        fontFamily="Caveat, cursive"
        fill="#a78bfa"
        width={400}
      />
    </Group>
  );
}

/* --- AiCorrectionNode --- */

interface AiCorrectionNodeProps {
  shape: AiCorrectionShape;
}

export function AiCorrectionNode({ shape }: AiCorrectionNodeProps) {
  const prefix = shape.props.isCorrect ? "\u2713 " : "\u2717 ";
  const textColor = shape.props.isCorrect ? "#16a34a" : "#dc2626";

  return (
    <Group x={shape.x} y={shape.y}>
      {/* Red background highlight for errors */}
      {!shape.props.isCorrect && (
        <Rect
          x={-4}
          y={-4}
          width={408}
          height={32}
          fill="#fef2f2"
          cornerRadius={4}
        />
      )}
      {/* Student step text with check/cross prefix */}
      <Text
        x={0}
        y={0}
        text={prefix + shape.props.text}
        fontSize={24}
        fontFamily="Caveat, cursive"
        fill={textColor}
        width={400}
      />
      {/* Correction text */}
      {shape.props.correction && (
        <Text
          x={0}
          y={30}
          text={shape.props.correction}
          fontSize={20}
          fontFamily="Caveat, cursive"
          fill="#dc2626"
          width={400}
        />
      )}
      {/* Rule text */}
      {shape.props.rule && (
        <Text
          x={0}
          y={shape.props.correction ? 54 : 30}
          text={shape.props.rule}
          fontSize={18}
          fontFamily="Caveat, cursive"
          fill="#6b7280"
          width={400}
        />
      )}
      {/* Hint text */}
      {shape.props.hint && (
        <Text
          x={0}
          y={shape.props.correction ? (shape.props.rule ? 76 : 54) : (shape.props.rule ? 52 : 30)}
          text={shape.props.hint}
          fontSize={18}
          fontFamily="Caveat, cursive"
          fontStyle="italic"
          fill="#7c3aed"
          width={400}
        />
      )}
    </Group>
  );
}
