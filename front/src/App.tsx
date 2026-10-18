import Apply from './components/Apply';
import Approach from './components/Approach';
import Brochure from './components/Brochure';
import Certificate from './components/Certificate';
import DemoDay from './components/DemoDay';
import Faq from './components/Faq';
import Footer from './components/Footer';
import Founder from './components/Founder';
import Header from './components/Header';
import Hero from './components/Hero';
import Lesson from './components/Lesson';
import MiniTask from './components/MiniTask';
import Modules from './components/Modules';
import Pricing from './components/Pricing';
import ProgramStats from './components/ProgramStats';
import SampleProject from './components/SampleProject';
import Skills from './components/Skills';
import { useReveal } from './hooks/useReveal';
import './styles/hover.css';

export default function App() {
  useReveal();

  return (
    <div style={{ background: '#FFFFFF', overflowX: 'clip', paddingTop: '73px' }}>
      <Header />
      <Hero />
      <ProgramStats />
      <Skills />
      <Lesson />
      <Approach />
      <Modules />
      <MiniTask />
      <SampleProject />
      <DemoDay />
      <Certificate />
      <Founder />
      <Pricing />
      <Brochure />
      <Faq />
      <Apply />
      <Footer />
    </div>
  );
}
