﻿
// disfigure
//
// A collection of space selectors - functions that return 1 if a point is inside
// the selected space, and 0 if it is outside. Boundaries of the spaces are foggy,
// so values between 0 and 1 are also possible.



import { Vector3 } from "three";
import { float, Fn, min, mix, positionGeometry, select, vec2, vec3 } from "three/tsl";
import { everybody } from './world.js';


console.time( 'TSL' );



// hide the spinner when the TSL's of all models are compiled
// or if some predefined time had ellapsed

var spinnerCounter = 0,
	spinner = document.getElementById( 'spinner' );

function loader( ) {

	spinnerCounter++;
	//	console.timeLog('TSL',spinnerCounter);
	if ( spinner && spinnerCounter >= everybody.length*12 ) {

		console.timeLog( 'TSL', spinnerCounter );
		spinner.style.display = 'none';

	}

}

if ( spinner ) {

	setTimeout( ()=>spinner.style.display = 'none', 10000 );

}



// generate oversmooth function
const smoother = Fn( ([ edge, value ])=>{

	return value.smoothstep( edge.x, edge.y ).smoothstep( 0, 1 ).smoothstep( 0, 1 );

}, { edge: 'vec2', value: 'float', return: 'float' } );



var tslLocusY = Fn( ([ pos, pivot, rangeY, slope ])=>{

	var y = pos.y,
		z = pos.z;

	y = y.add( z.sub( pivot.z ).div( slope ) );

	return smoother( rangeY, y );

}, { pos: 'vec3', pivot: 'vec3', rangeY: 'vec2', slope: 'float', return: 'float' } ); // tslLocusY



var tslLocusX = Fn( ([ pos, rangeX ])=>{

	return smoother( rangeX, pos.x );

}, { pos: 'vec3', rangeX: 'vec2', return: 'float' } ); // tslLocusX



var tslLocusXY = Fn( ([ pos, pivot, rangeX, rangeY ])=>{

	var x = pos.x,
		y = pos.y;

	var dx = y.sub( pivot.y ).div( 4, x.sign() );

	return smoother( rangeX, x.add( dx ) )
		.mul( min(
			y.smoothstep( rangeY.x, mix( rangeY.x, rangeY.y, 0.2 ) ),
			y.smoothstep( rangeY.y, mix( rangeY.y, rangeY.x, 0.2 ) ),
		) )
		.pow( 2 );

}, { pos: 'vec3', pivot: 'vec3', rangeX: 'vec2', rangeY: 'vec2', return: 'float' } ); // tslLocusX



var tslLocusT = Fn( ([ pos, pivot, rangeX, rangeY, grown ])=>{

	var x = pos.x,
		y = pos.y,
		z = pos.z;

	var s = vec3( x.mul( 2.0 ), y, z.min( 0 ) )
		.sub( vec3( 0, pivot.y, 0 ) )
		.length()
		.smoothstep( 0, float( 0.13 ).div( float( grown ).add( 1 ) ) )
		.pow( 10 );

	var yy = y.sub( x.abs().mul( 1/5 ) );

	yy = yy.add( select( grown.equal( 1 ), z.abs().mul( 1/2 ), z.mul( 1/6 ) ) );

	return s
		.mul(
			x.smoothstep( rangeX.x, rangeX.y ),
			smoother( rangeY, yy ).pow( 2 ),
		);

}, { pos: 'vec3', pivot: 'vec3', rangeX: 'vec2', rangeY: 'vec2', grown: 'float', return: 'float' } ); // tslLocusX



class Locus {

	constructor( pivot ) {

		this.pivot = new Vector3( ...pivot );
		this.isRight = false;

	} // Locus.constructor

	mirror( ) {

		this.isRight = true;

		this.pivot.x *= -1;

		if ( this.rangeX ) {

			this.rangeX.value.x *= -1;
			this.rangeX.value.y *= -1;

		}

		return this;

	} // Locus.mirror

} // Locus



// define a horizontal planar locus that can tilt fowrard (i.e. around X axix,
// towards the screen); vertically it is from minY to maxY, horizontally it is
// infinite; areas outside rangeX are consider inside the locus
class LocusY extends Locus {

	constructor( pivot, rangeY, angle=0 ) {

		super( pivot );

		this.rangeY = vec2( ...rangeY );
		this.slope = Math.tan( ( 90-angle ) * Math.PI/180 );

	} // constructor

	locus( ) {

		return tslLocusY( positionGeometry, this.pivot, this.rangeY, this.slope );

	} // locus

} // LocusY



// define a vertical planar locus, perpendicular to X; vertically infinite,
// horizontally from minX to maxX
class LocusX extends Locus {

	constructor( pivot, rangeX ) {

		super( pivot );

		this.rangeX = vec2( ...rangeX );

	} // constructor

	locus( ) {

		return tslLocusX( positionGeometry, this.rangeX );

	} // locus

} // LocusX



// define a rectangular locus, from minX to maxX, from minY to maxY, but infinite along Z
class LocusXY extends LocusX {

	constructor( pivot, rangeX, rangeY ) {

		super( pivot, rangeX );

		this.rangeY = vec2( ...rangeY );

	} // constructor

	locus( ) {

		loader();

		return tslLocusXY( positionGeometry, this.pivot, this.rangeX, this.rangeY );

	} // locus

} // LocusXY



// define custom locus specifically for hips
class LocusT extends LocusXY {

	constructor( pivot, rangeX, rangeY, grown=0 ) {

		super( pivot, rangeX, rangeY );

		this.grown = grown;

	} // constructor

	locus( ) {

		return tslLocusT( positionGeometry, this.pivot, this.rangeX, this.rangeY, this.grown );

	} // locus

} // LocusT



// the definition of a space around a model including properties of individual
// subspaces that simulate joints
class Space {

	constructor( bodyPartsDef ) {

		var centrals = { head: LocusY, chest: LocusY, waist: LocusY, torso: LocusY },
			symmetricals = { knee: LocusY, ankle: LocusY, shin: LocusY, thigh: LocusY, foot: LocusY, leg: LocusT, elbow: LocusX, forearm: LocusX, wrist: LocusX, arm: LocusXY };

		for ( var name in centrals )
			this[ name ] = new ( centrals[ name ])( ...bodyPartsDef[ name ]);

		for ( var name in symmetricals ) {

			this[ 'l_'+name ] = new ( symmetricals[ name ])( ...bodyPartsDef[ name ]);
			this[ 'r_'+name ] = new ( symmetricals[ name ])( ...bodyPartsDef[ name ]).mirror();

		}

	} // Space.constructor

} // Space



export { Space, LocusX, LocusT };
