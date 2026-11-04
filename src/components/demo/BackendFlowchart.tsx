import React from 'react';
import { motion } from 'framer-motion';

export type FlowchartStep = 'idle' | 'analyzing' | 'simulating' | 'generating' | 'complete';

interface BackendFlowchartProps {
    currentStep: FlowchartStep;
}

export default function BackendFlowchart({ currentStep }: BackendFlowchartProps) {
    const steps = [
        { id: 'idle', label: 'Waiting for Input', icon: '👤', desc: 'Standing by for user context' },
        { id: 'analyzing', label: 'Context Analysis', icon: '🧠', desc: 'Parsing financial profile & prompt' },
        { id: 'simulating', label: 'Scenario Simulation', icon: '📈', desc: 'Running Monte Carlo projections' },
        { id: 'generating', label: 'Plan Generation', icon: '📋', desc: 'Synthesizing actionable steps' },
        { id: 'complete', label: 'Ready', icon: '✅', desc: 'Financial plan delivered' }
    ];

    const getStepStatus = (stepId: string) => {
        const currentIndex = steps.findIndex(s => s.id === currentStep);
        const stepIndex = steps.findIndex(s => s.id === stepId);

        if (stepIndex < currentIndex) return 'completed';
        if (stepIndex === currentIndex) return 'active';
        return 'pending';
    };

    return (
        <div className="w-full h-full bg-[var(--pf-bg-dark)] border-l border-[var(--pf-border)] flex flex-col pt-[70px] px-8 pb-10">
            <div className="mb-10">
                <h2 className="text-[14px] font-semibold text-[var(--pf-text-secondary)] uppercase tracking-widest mb-2">Backend Process</h2>
                <p className="text-[13px] text-[var(--pf-text-tertiary)]">Live visualization of Pathfinder AI execution flow.</p>
            </div>

            <div className="relative flex-1 flex flex-col justify-between max-h-[600px]">
                {/* Connecting Line */}
                <div className="absolute left-[24px] top-[30px] bottom-[30px] w-[2px] bg-[#2A2A2A] z-0" />

                {/* Animated Progress Line */}
                <motion.div
                    className="absolute left-[24px] top-[30px] w-[2px] bg-[#148749] z-0"
                    initial={{ height: '0%' }}
                    animate={{
                        height: `${(steps.findIndex(s => s.id === currentStep) / (steps.length - 1)) * 100}%`
                    }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                />

                {steps.map((step, index) => {
                    const status = getStepStatus(step.id);

                    return (
                        <div key={step.id} className="relative z-10 flex items-start gap-5">
                            <motion.div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center text-[20px] shrink-0 border-2 transition-colors duration-500`}
                                animate={{
                                    backgroundColor: status === 'active' ? 'rgba(20, 135, 73, 0.15)' : status === 'completed' ? '#148749' : '#1A1A1A',
                                    borderColor: status === 'active' ? '#148749' : status === 'completed' ? '#148749' : '#333333',
                                    color: status === 'completed' ? '#FFFFFF' : 'inherit'
                                }}
                                transition={{ duration: 0.3 }}
                            >
                                {step.icon}
                            </motion.div>

                            <div className="flex flex-col pt-1">
                                <motion.span
                                    className={`text-[16px] font-bold transition-colors duration-500`}
                                    animate={{
                                        color: status === 'active' ? '#FFFFFF' : status === 'completed' ? '#CCCCCC' : '#666666'
                                    }}
                                >
                                    {step.label}
                                </motion.span>
                                <motion.span
                                    className="text-[13px] mt-0.5 transition-colors duration-500"
                                    animate={{
                                        color: status === 'active' ? '#A0A0A0' : '#555555'
                                    }}
                                >
                                    {step.desc}
                                </motion.span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
