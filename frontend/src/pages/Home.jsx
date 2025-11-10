import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, HeartHandshake, BarChart3, Timer } from 'lucide-react';

export default function Home(){
  const card = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 }
  };

  return (
    // 整块主区域：更高、更显眼
    <section className="min-h-[70vh] flex items-center justify-center bg-gradient-to-b from-white via-blue-50/40 to-pink-50/30 rounded-3xl shadow-inner p-6 md:p-10">
      {/* 内部内容容器：更宽 */}
      <div className="w-full max-w-7xl mx-auto space-y-8">
        {/* Hero 更大更居中 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-pink-100/70 to-blue-100/70 p-10 md:p-12 w-full max-w-5xl mx-auto text-left md:text-left"
        >
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
              Gentle support, one step at a time.
            </h1>
            <p className="mt-3 text-base opacity-80">
              A soft, private space to check-in, find coping tools, and stay supported during meals.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/checkin" className="btn btn-primary">Start Check-In</Link>
              <Link to="/toolbox" className="btn">Open Toolbox</Link>
            </div>
          </div>

          {/* 漂浮装饰 */}
          <motion.div
            aria-hidden
            className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-pink-200/40 blur-2xl"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* 功能卡片：两行两列，更高更大 */}
        <div className="rounded-3xl bg-base-100/60 p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Daily Check-In */}
            <motion.div variants={card} initial="initial" animate="animate" transition={{ delay: 0.05 }}>
              <Link className="card bg-base-200/80 hover:bg-base-200 p-6 shadow-md hover:shadow-lg transition h-80 flex flex-col"
                    to="/checkin">
                <img
                  src="https://images.unsplash.com/photo-1513553404607-988bf2703777?auto=format&fit=crop&w=1200&q=80"
                  alt="Journal"
                  className="rounded-xl mb-4 h-48 w-full object-cover"
                />
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="font-semibold">Daily Check-In</h3>
                </div>
                <p className="mt-2 opacity-70 text-sm">Mood, urges, meal status, and a gentle note.</p>
              </Link>
            </motion.div>

            {/* Toolbox */}
            <motion.div variants={card} initial="initial" animate="animate" transition={{ delay: 0.12 }}>
              <Link className="card bg-base-200/80 hover:bg-base-200 p-6 shadow-md hover:shadow-lg transition h-80 flex flex-col"
                    to="/toolbox">
                <img
                  src="https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80"
                  alt="Hands support"
                  className="rounded-xl mb-4 h-48 w-full object-cover"
                />
                <div className="flex items-center gap-3">
                  <HeartHandshake className="w-5 h-5" />
                  <h3 className="font-semibold">Coping Toolbox</h3>
                </div>
                <p className="mt-2 opacity-70 text-sm">Grounding, urge surfing, self-compassion and more.</p>
              </Link>
            </motion.div>

            {/* Progress */}
            <motion.div variants={card} initial="initial" animate="animate" transition={{ delay: 0.18 }}>
              <Link className="card bg-base-200/80 hover:bg-base-200 p-6 shadow-md hover:shadow-lg transition h-80 flex flex-col"
                    to="/progress">
                <img
                  src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80"
                  alt="Sunrise progress"
                  className="rounded-xl mb-4 h-48 w-full object-cover"
                />
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5" />
                  <h3 className="font-semibold">Progress</h3>
                </div>
                <p className="mt-2 opacity-70 text-sm">See your last 7 days at a glance.</p>
              </Link>
            </motion.div>

            {/* Meal Support（新增） */}
            <motion.div variants={card} initial="initial" animate="animate" transition={{ delay: 0.22 }}>
              <Link className="card bg-base-200/80 hover:bg-base-200 p-6 shadow-md hover:shadow-lg transition h-80 flex flex-col"
                    to="/meal">
                <img
                  src="https://images.unsplash.com/photo-1528716321680-815a8cdb8cbe?auto=format&fit=crop&w=1200&q=80"
                  alt="Meal support"
                  className="rounded-xl mb-4 h-48 w-full object-cover"
                />
                <div className="flex items-center gap-3">
                  <Timer className="w-5 h-5" />
                  <h3 className="font-semibold">Meal Support</h3>
                </div>
                <p className="mt-2 opacity-70 text-sm">A 5-minute timer with gentle prompts during meals.</p>
              </Link>
            </motion.div>
          </div>
        </div>

        <p className="text-xs opacity-70 text-center">
          If you’re in crisis, call 988 (US) or your local emergency number.
        </p>
      </div>
    </section>
  );
}
