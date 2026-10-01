package com.planit.quiz;

import java.util.List;

/**
 * 오늘 학습 범위로 퀴즈 문제를 만드는 방법을 감추는 인터페이스 (REQ-Q-002, REQ-Q-003).
 * Mock 은 고정 예시 3개, Gemini 는 항목마다 2문제를 만든다.
 * OpenAI 연동(박지민 담당)이 정해지면 이 인터페이스를 구현하는 클래스를 @Primary 로 등록하면 된다.
 */
public interface QuizQuestionGenerator {

	/** 출제 대상 항목마다 쉬운 문제(BASIC) 1개 + 응용 문제(APPLIED) 1개, 항목 순서대로. */
	List<GeneratedQuestion> generate(String subjectName, List<String> scopeParts);
}
