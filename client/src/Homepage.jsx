import { useEffect } from 'react'
import fetchQuestions from './services/TestGen'

export default function Homepage() {
  useEffect(() => {
    fetchQuestions()
  });

  return (
    <></>
  );
}