import React  from 'react'
import ReactDOM from 'react-dom'
import { HashRouter, Switch, Route, Redirect } from 'react-router-dom'
import Rooms from './rooms'
import RoomCall from './room-call'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import './state.js'

window.localStorage.setItem('debug', '*');

function App() {
  return (
    <HashRouter>
      <Switch>
        <Route exact path="/">
          <Redirect to="/rooms"/>
        </Route>
        <Route exact path="/rooms" component={Rooms}/>
        <Route exact path="/rooms/:roomId" component={RoomCall}/>
      </Switch>
    </HashRouter>
  )
}

ReactDOM.render(
  <App/>,
  document.getElementById('react-root')
)
